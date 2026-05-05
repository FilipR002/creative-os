import type { Metadata } from 'next';
import SwaggerUI from './SwaggerUI';

export const metadata: Metadata = {
  title: 'API Docs — Creative OS',
  description: 'Interactive Swagger documentation for the Creative OS backend API',
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI />
    </div>
  );
}
