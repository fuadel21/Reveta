import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Phone, PhoneOff, Shield } from 'lucide-react';

type CallSession = Tables<'call_sessions'>;
type CallSignal = Tables<'call_signals'>;

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CLOSED_CALL_STATUSES = ['ended', 'declined', 'expired', 'cancelled'];

const CallRoom = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [call, setCall] = useState<CallSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [statusText, setStatusText] = useState('Preparando llamada privada...');

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const handledSignalsRef = useRef<Set<string>>(new Set());
  const startedRef = useRef(false);

  const isCaller = !!user && !!call && user.id === call.caller_id;
  const isParticipant = !!user && !!call && (user.id === call.caller_id || user.id === call.callee_id);
  const isClosedCall = !!call?.status && CLOSED_CALL_STATUSES.includes(call.status);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!id || !user) return;
    fetchCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    if (!call || !user || !isParticipant || isClosedCall) return;

    const channel = supabase
      .channel(`call-room:${call.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `call_id=eq.${call.id}` }, (payload) => handleIncomingSignal(payload.new as CallSignal))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `id=eq.${call.id}` }, (payload) => {
        const updated = payload.new as CallSession;
        setCall(updated);
        if (CLOSED_CALL_STATUSES.includes(updated.status)) {
          cleanupCall();
          setHasStarted(false);
          startedRef.current = false;
          setStatusText(updated.status === 'declined' ? 'Llamada rechazada' : 'Llamada finalizada');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id, user?.id, isParticipant, isClosedCall]);

  useEffect(() => () => cleanupCall(), []);

  const fetchCall = async () => {
    if (!id || !user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('call_sessions')
      .select('id, product_id, caller_id, callee_id, status, created_at, updated_at, ended_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      toast({ title: 'Llamada no disponible', description: 'No se encontró la sala de llamada.', variant: 'destructive' });
      navigate('/messages');
      return;
    }

    if (user.id !== data.caller_id && user.id !== data.callee_id) {
      setCall(data as CallSession);
      setLoading(false);
      return;
    }

    if (CLOSED_CALL_STATUSES.includes(data.status)) {
      setStatusText(data.status === 'declined' ? 'Llamada rechazada' : 'Llamada finalizada');
    }

    setCall(data as CallSession);
    setLoading(false);
  };

  const createPeerConnection = async () => {
    if (!user || !call || !isParticipant || isClosedCall) return null;

    const peer = new RTCPeerConnection(rtcConfig);

    peer.onicecandidate = async (event) => {
      if (!event.candidate) return;
      await sendSignal('ice', event.candidate.toJSON() as unknown as Json);
    };

    peer.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) remoteAudioRef.current.srcObject = event.streams[0];
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setConnected(true);
        setStatusText('Llamada conectada');
      } else if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        setConnected(false);
        setStatusText('La conexión se ha interrumpido');
      } else if (peer.connectionState === 'closed') {
        setConnected(false);
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));

    peerRef.current = peer;
    return peer;
  };

  const sendSignal = async (type: CallSignal['type'], payload: Json) => {
    if (!user || !call || !isParticipant || isClosedCall) return;
    const { error } = await supabase.from('call_signals').insert({ call_id: call.id, sender_id: user.id, type, payload });
    if (error) console.error('Error sending call signal:', error);
  };

  const handleIncomingSignal = async (signal: CallSignal) => {
    if (!user || !call || !isParticipant || isClosedCall) return;
    if (signal.sender_id === user.id) return;
    if (handledSignalsRef.current.has(signal.id)) return;
    handledSignalsRef.current.add(signal.id);

    try {
      let peer = peerRef.current;
      if (!peer) peer = await createPeerConnection();
      if (!peer) return;

      if (signal.type === 'offer') {
        setStatusText('Oferta recibida. Conectando...');
        await peer.setRemoteDescription(new RTCSessionDescription(signal.payload as unknown as RTCSessionDescriptionInit));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await sendSignal('answer', answer as unknown as Json);
        await updateCallStatus('active');
      }

      if (signal.type === 'answer') {
        setStatusText('Respuesta recibida. Estableciendo llamada...');
        await peer.setRemoteDescription(new RTCSessionDescription(signal.payload as unknown as RTCSessionDescriptionInit));
        await updateCallStatus('active');
      }

      if (signal.type === 'ice') await peer.addIceCandidate(new RTCIceCandidate(signal.payload as unknown as RTCIceCandidateInit));
    } catch (error) {
      console.error('Error handling call signal:', error);
      setStatusText('No se pudo conectar la llamada');
    }
  };

  const loadExistingSignals = async () => {
    if (!call || !user || !isParticipant || isClosedCall) return;

    const { data, error } = await supabase
      .from('call_signals')
      .select('id, call_id, sender_id, type, payload, created_at')
      .eq('call_id', call.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading existing call signals:', error);
      return;
    }

    for (const signal of data || []) await handleIncomingSignal(signal as CallSignal);
  };

  const startCall = async () => {
    if (!call || !user || startedRef.current) return;

    if (!isParticipant) {
      toast({ title: 'Acceso denegado', description: 'Solo los participantes pueden entrar a esta llamada.', variant: 'destructive' });
      return;
    }

    if (isClosedCall) {
      toast({ title: 'Llamada finalizada', description: 'Esta llamada ya no está disponible.', variant: 'destructive' });
      return;
    }

    startedRef.current = true;
    setHasStarted(true);
    setJoining(true);

    try {
      setStatusText('Solicitando permiso de micrófono...');
      const peer = await createPeerConnection();
      if (!peer) return;

      await loadExistingSignals();

      if (isCaller) {
        setStatusText('Creando llamada privada...');
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await sendSignal('offer', offer as unknown as Json);
        setStatusText('Esperando al otro usuario...');
      } else {
        setStatusText('Entrando en la llamada privada...');
      }
    } catch (error) {
      console.error('Error starting call:', error);
      toast({ title: 'No se pudo iniciar la llamada', description: 'Revisa los permisos del micrófono.', variant: 'destructive' });
      cleanupCall();
      startedRef.current = false;
      setHasStarted(false);
    } finally {
      setJoining(false);
    }
  };

  const updateCallStatus = async (status: CallSession['status']) => {
    if (!call || !user || !isParticipant) return;
    const now = new Date().toISOString();
    await supabase
      .from('call_sessions')
      .update({ status, updated_at: now, ...(status === 'ended' ? { ended_at: now } : {}) })
      .eq('id', call.id)
      .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`);
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  const cleanupCall = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    peerRef.current?.close();
    peerRef.current = null;
    setConnected(false);
    setMuted(false);
  };

  const endCall = async () => {
    cleanupCall();
    await updateCallStatus('ended');
    navigate('/messages');
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (!call || !isParticipant) {
    return (
      <>
        <Helmet><title>Llamada privada | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
        <div className="min-h-screen flex flex-col bg-background"><Header /><main className="flex-1 container py-8 max-w-xl"><Card><CardHeader><CardTitle>Acceso no permitido</CardTitle><CardDescription>Esta llamada privada solo está disponible para los dos usuarios del producto.</CardDescription></CardHeader><CardContent><Button onClick={() => navigate('/messages')} className="w-full">Volver a mensajes</Button></CardContent></Card></main><Footer /></div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Llamada privada | Reveta</title><meta name="description" content="Sala privada de llamada entre comprador y vendedor en Reveta" /><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 max-w-xl">
          <Card className="border-border/50">
            <CardHeader className="text-center"><div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4"><Phone className="h-10 w-10 text-primary" /></div><CardTitle>Llamada privada de Reveta</CardTitle><CardDescription>{statusText}</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <audio ref={remoteAudioRef} autoPlay playsInline />
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm text-muted-foreground flex gap-3"><Shield className="h-5 w-5 text-primary shrink-0" /><p>Esta llamada usa audio del navegador. Reveta no muestra números de teléfono entre usuarios.</p></div>
              {isClosedCall && <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">Esta llamada ya terminó. Vuelve a mensajes para continuar por chat o solicitar una nueva llamada.</div>}
              <div className="flex items-center justify-center gap-3">
                {!hasStarted ? (
                  <Button onClick={startCall} disabled={joining || isClosedCall} className="h-14 px-8 text-base font-bold"><Phone className="h-5 w-5 mr-2" />{joining ? 'Conectando...' : 'Entrar en llamada'}</Button>
                ) : (
                  <><Button variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={toggleMute}>{muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</Button><Button variant="destructive" size="icon" className="h-14 w-14 rounded-full" onClick={endCall}><PhoneOff className="h-6 w-6" /></Button></>
                )}
              </div>
              {connected && <p className="text-center text-sm text-green-600 font-medium">Conectado</p>}
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default CallRoom;
