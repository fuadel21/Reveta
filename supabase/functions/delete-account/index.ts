import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Create client with user token to get user info
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    // Get user from token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Starting account deletion for user: ${userId}`);

    // Delete user data in order (respecting foreign keys)
    
    // 1. Delete notifications
    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', userId);
    if (notifError) console.error('Error deleting notifications:', notifError);
    else console.log('Deleted notifications');

    // 2. Delete reviews (as reviewer)
    const { error: reviewsError } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('reviewer_id', userId);
    if (reviewsError) console.error('Error deleting reviews:', reviewsError);
    else console.log('Deleted reviews as reviewer');

    // 3. Delete reviews (as seller)
    const { error: reviewsSellerError } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('seller_id', userId);
    if (reviewsSellerError) console.error('Error deleting reviews as seller:', reviewsSellerError);
    else console.log('Deleted reviews as seller');

    // 4. Delete reports
    const { error: reportsError } = await supabaseAdmin
      .from('reports')
      .delete()
      .eq('reporter_id', userId);
    if (reportsError) console.error('Error deleting reports:', reportsError);
    else console.log('Deleted reports');

    // 5. Delete favorites
    const { error: favError } = await supabaseAdmin
      .from('favorites')
      .delete()
      .eq('user_id', userId);
    if (favError) console.error('Error deleting favorites:', favError);
    else console.log('Deleted favorites');

    // 6. Get user's conversations to delete related data
    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    
    if (conversations && conversations.length > 0) {
      const convIds = conversations.map(c => c.id);
      
      // Delete offers in user's conversations
      const { error: offersError } = await supabaseAdmin
        .from('offers')
        .delete()
        .in('conversation_id', convIds);
      if (offersError) console.error('Error deleting offers:', offersError);
      else console.log('Deleted offers');

      // Delete messages in user's conversations
      const { error: messagesError } = await supabaseAdmin
        .from('messages')
        .delete()
        .in('conversation_id', convIds);
      if (messagesError) console.error('Error deleting messages:', messagesError);
      else console.log('Deleted messages');
    }

    // 7. Delete conversations
    const { error: convBuyerError } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('buyer_id', userId);
    if (convBuyerError) console.error('Error deleting conversations as buyer:', convBuyerError);
    
    const { error: convSellerError } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('seller_id', userId);
    if (convSellerError) console.error('Error deleting conversations as seller:', convSellerError);
    console.log('Deleted conversations');

    // 8. Get user's products for image cleanup
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, images')
      .eq('user_id', userId);

    // 9. Delete favorites of user's products
    if (products && products.length > 0) {
      const productIds = products.map(p => p.id);
      const { error: productFavError } = await supabaseAdmin
        .from('favorites')
        .delete()
        .in('product_id', productIds);
      if (productFavError) console.error('Error deleting product favorites:', productFavError);
    }

    // 10. Delete products
    const { error: productsError } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('user_id', userId);
    if (productsError) console.error('Error deleting products:', productsError);
    else console.log('Deleted products');

    // 11. Delete product images from storage
    if (products) {
      for (const product of products) {
        if (product.images && product.images.length > 0) {
          for (const imageUrl of product.images) {
            try {
              // Extract path from URL
              const urlParts = imageUrl.split('/storage/v1/object/public/products/');
              if (urlParts[1]) {
                const { error: storageError } = await supabaseAdmin.storage
                  .from('products')
                  .remove([urlParts[1]]);
                if (storageError) console.error('Error deleting image:', storageError);
              }
            } catch (e) {
              console.error('Error parsing image URL:', e);
            }
          }
        }
      }
      console.log('Deleted product images from storage');
    }

    // 12. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profileError) console.error('Error deleting profile:', profileError);
    else console.log('Deleted profile');

    // 13. Delete auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully deleted account for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
