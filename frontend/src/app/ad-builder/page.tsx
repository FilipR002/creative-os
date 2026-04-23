'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdBuilderRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/create?mode=quick'); }, [router]);
  return null;
}
