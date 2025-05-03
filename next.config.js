/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	images: {
	  domains: ['tr.rbxcdn.com'],
	},
	env: {
	  NEXT_PUBLIC_DATABASE_CHECK: process.env.DATABASE_URL ? 'true' : '',
	},
  };
  
  module.exports = nextConfig;
  