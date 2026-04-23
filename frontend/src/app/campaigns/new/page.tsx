'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewCampaignRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/create?mode=campaign'); }, [router]);
  return null;
}
