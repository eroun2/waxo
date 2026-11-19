import { Navigate } from 'react-router-dom';
import { Download, Globe2, ShieldCheck, Upload } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { LinkButton, Page } from '../components/ui';

const FEATURES = [
  { icon: Upload, title: 'Upload in minutes', text: 'MP3, WAV, FLAC and more. We keep your original safe and prepare the streaming versions for you.' },
  { icon: Download, title: 'You choose downloads', text: 'Turn downloads on or off for every song, and see exactly how many streams and downloads you earn.' },
  { icon: Globe2, title: 'Be found in your district', text: 'District charts and rising-star lists put local talent in front of listeners who care.' },
  { icon: ShieldCheck, title: 'Your music stays yours', text: 'Unreleased songs stay private, and our team reviews content before it goes live.' },
];

export default function ForArtists() {
  const { me, status } = useAuth();
  if (status === 'authed' && me?.role === 'artist') return <Navigate to="/studio/upload" replace />;
  return (
    <Page className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Your music deserves an audience.</h1>
        <p className="mt-4 text-lg text-muted">Publish your songs on WaXo, get discovered across districts, and grow a following that supports local talent.</p>
        <div className="mt-8 flex justify-center">
          {status === 'authed' ? <p className="text-sm text-muted">You're signed in as a listener. To upload music, create a separate artist account with a different email.</p>
            : <LinkButton to="/join?as=artist" size="lg">Create your artist profile</LinkButton>}
        </div>
      </div>
      <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: I, title, text }) => (
          <div key={title} className="rounded-card border border-line p-6"><I className="h-6 w-6" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{text}</p></div>
        ))}
      </div>
      <ol className="mx-auto mt-16 max-w-2xl space-y-4">
        {['Create your artist profile.', 'Verify your email and get approved by our team.', 'Upload your songs and choose your settings.', 'Share your WaXo links and watch your audience grow.'].map((t, i) => (
          <li key={t} className="flex items-center gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fg text-sm font-bold text-bg">{i + 1}</span><span>{t}</span></li>
        ))}
      </ol>
    </Page>
  );
}
