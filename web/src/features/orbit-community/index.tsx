import { Link } from '@tanstack/react-router'

import { OrbitPublicPage } from '@/features/home/components/orbit-landing'
import { ORBIT_BRAND } from '@/lib/orbit-brand'

const programs = {
  students: {
    title: 'BEU student verification',
    text: 'Manual verification is planned for BEU students using full name, roll number, registration number, branch, and college, followed by administrator review. Planned benefits are 15 requests per minute with standard token caps removed, subject to fair use and provider availability.',
  },
  sponsorship: {
    title: 'AI API Support for College Events & Tech Fests',
    text: 'A future program for BEU-affiliated hackathons, workshops, and tech fests. Support will depend on review, resources, and provider availability. No credits, provider access, or sponsorship are guaranteed.',
  },
  requests: {
    title: 'Community & limit-increase requests',
    text: 'A dedicated place for model suggestions and limit-increase requests is planned. There is no request submission workflow yet. Additional access will depend on review and available resources.',
  },
} as const
export function PlannedProgram({
  program,
}: {
  program: keyof typeof programs
}) {
  const details = programs[program]
  return (
    <OrbitPublicPage title={details.title}>
      <p className='orbit-eyebrow'>
        Planned program · Applications are not open
      </p>
      <p>{details.text}</p>
      <p>
        Do not submit personal documents or payment information for a planned
        program.
      </p>
      <p>
        <Link to='/access-limits'>Planned access & limits</Link> ·{' '}
        <Link to='/'>Back to Orbit</Link>
      </p>
    </OrbitPublicPage>
  )
}
export function OrbitDocumentation() {
  return (
    <OrbitPublicPage title='Your first steps with Orbit.' active='/docs'>
      <p>
        One gateway, familiar APIs, and account controls. This development
        preview does not supply live provider access. Start with the models and
        allowance configured for your own instance.
      </p>
      <section>
        <h2>1. Create an account</h2>
        <p>
          Register when account creation is open, or sign in to an existing
          account. Keep your password and recovery details private.
        </p>
        <Link to='/sign-in'>Sign in</Link>
      </section>
      <section>
        <h2>2. Check models and allowance</h2>
        <p>
          The Orbit Model Hub is a planned catalog. The separate configured
          gateway catalog shows models enabled by the instance administrator.
          Your dashboard shows current quota and usage.
        </p>
        <p>
          <Link to='/model-hub'>Orbit Model Hub</Link> ·{' '}
          <Link to='/pricing'>Configured gateway models</Link> ·{' '}
          <Link to='/access-limits'>Planned limits</Link>
        </p>
      </section>
      <section>
        <h2>3. Create an API key</h2>
        <p>
          Open API key management from your dashboard. Use the smallest
          permissions and limits your application needs. Keep keys in
          server-side environment variables; never expose a real key in frontend
          code or commit it to Git.
        </p>
        <Link to='/keys'>Manage API keys (sign-in required)</Link>
      </section>
      <section>
        <h2>4. Configure your client</h2>
        <p>
          For an OpenAI-compatible SDK, use your configured instance URL
          followed by <code>/v1</code>, your API key, and an enabled model ID.
          Supported endpoints depend on the model.
        </p>
        <p>
          The proposed public endpoint,{' '}
          <code>https://api.beudeveloper.in/v1</code>, is planned and has not
          been deployed. The eight Orbit model IDs are presentation entries and
          are not provider assignments.
        </p>
        <a href='https://docs.newapi.ai/en/'>Upstream API documentation</a>
      </section>
      <section id='legal'>
        <h2>Open source and attribution</h2>
        <p>
          Orbit is a community fork of New API by QuantumNous and its
          contributors, based on One API. Frontend design and development by New
          API contributors. Orbit changes are maintained independently by BEU
          Developer.
        </p>
        <p>
          <a href={ORBIT_BRAND.source}>Orbit source</a> ·{' '}
          <a href={ORBIT_BRAND.upstream}>New API source</a> ·{' '}
          <a href={`${ORBIT_BRAND.source}/blob/main/LICENSE`}>AGPLv3 license</a>{' '}
          ·{' '}
          <a href={`${ORBIT_BRAND.source}/blob/main/NOTICE`}>
            Attribution notices
          </a>
        </p>
      </section>
    </OrbitPublicPage>
  )
}
