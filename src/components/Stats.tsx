import { Users, Package, MapPin, Shield, TrendingUp } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: "2M+",
    label: "Usuarios activos",
    description: "Compra y vende con confianza",
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Package,
    value: "5M+",
    label: "Productos publicados",
    description: "Encuentra lo que buscas",
    color: "from-primary to-primary/80",
    bgColor: "bg-primary/10",
  },
  {
    icon: MapPin,
    value: "500+",
    label: "Ciudades",
    description: "En toda España",
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: Shield,
    value: "100%",
    label: "Seguro",
    description: "Transacciones protegidas",
    color: "from-green-500 to-emerald-500",
    bgColor: "bg-green-500/10",
  },
];

const Stats = () => {
  return (
    <section className="py-16 md:py-20 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-background pointer-events-none" />
      
      <div className="container relative">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            <TrendingUp className="h-4 w-4" />
            <span>Estadísticas en tiempo real</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            La comunidad más grande de España
          </h2>
        </div>
        
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="group relative bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Gradient border effect on hover */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${stat.bgColor} transition-transform duration-300 group-hover:scale-110`}>
                <stat.icon className={`h-7 w-7 bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`} style={{ WebkitBackgroundClip: 'text' }} />
              </div>
              <div className={`text-3xl font-bold bg-gradient-to-br ${stat.color} bg-clip-text text-transparent md:text-4xl`}>{stat.value}</div>
              <div className="mt-1 font-semibold text-foreground">{stat.label}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
