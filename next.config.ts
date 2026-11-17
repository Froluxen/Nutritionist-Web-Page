import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Atajos tolerantes a errores de escritura en la ruta del panel.
      { source: "/dash/:path*", destination: "/dashboard/:path*", permanent: false },
      { source: "/admin", destination: "/dashboard/admin", permanent: false },
      {
        source: "/admin/:path*",
        destination: "/dashboard/admin/:path*",
        permanent: false,
      },
      {
        source: "/dashboard/admin/pago",
        destination: "/dashboard/admin/pagos",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
