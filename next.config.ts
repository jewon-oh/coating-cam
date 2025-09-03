import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    /* config options here */
    output: 'export',
    trailingSlash: true,
    reactStrictMode: false,
    allowedDevOrigins: ["192.168.0.161"]
};

export default nextConfig;
