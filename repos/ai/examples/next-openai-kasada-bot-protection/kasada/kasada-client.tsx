import Script from 'next/script';

export function KasadaClient() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            `document.addEventListener('kpsdk-load', () => {window.KPSDK.configure([
          {
            domain: location.host,
            path: '/api/chat',
            method: 'POST'
          },
        ]);
    });`.replace(/[\n\r\s]/g, ''),
        }}
      ></script>
      <Script
        async={true}
        src="/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/p.js"
      ></Script>
    </>
  );
}
