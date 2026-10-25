import { LicenseForm } from '@/components/LicenseForm';
import { ProGate } from '@/components/ProGate';
import { usePro } from '@/components/usePro';

// Replace the two feature blocks with your own extension's features.
export default function App() {
  const { pro } = usePro();
  return (
    <main>
      <header>
        <h1>My Extension</h1>
        {pro && <span className="badge">Pro</span>}
      </header>

      <section>
        <h2>Free feature</h2>
        <p>Everyone gets this.</p>
      </section>

      <section>
        <h2>Pro feature</h2>
        <ProGate>
          <p>Only paying users see this.</p>
        </ProGate>
      </section>

      {!pro && <LicenseForm />}
      <footer>
        <a href={browser.runtime.getURL('/options.html')} target="_blank" rel="noreferrer">
          License settings
        </a>
      </footer>
    </main>
  );
}
