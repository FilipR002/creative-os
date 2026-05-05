'use client';

import { useEffect, useState } from 'react';
import SwaggerUIReact from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://creative-os-production-4919.up.railway.app';

export default function SwaggerUI() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <SwaggerUIReact
      url={`${API_URL}/docs-json`}
      docExpansion="list"
      defaultModelsExpandDepth={1}
      displayRequestDuration
      filter
      tryItOutEnabled
    />
  );
}
