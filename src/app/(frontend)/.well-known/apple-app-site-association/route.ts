/* Universal Links: Links aus den Konto-Mails (/konto/…) öffnen die App statt der Webseite, sofern sie
   installiert ist. iOS lädt diese Datei beim Installieren (über Apples CDN, zwischengespeichert). */
const TEAM = '3498DS659A'
const APPS = ['de.offected.lever', 'de.offected.lever.dev']

export const dynamic = 'force-static'

export function GET() {
  return Response.json({
    applinks: {
      details: [{ appIDs: APPS.map(id => `${TEAM}.${id}`), components: [{ '/': '/konto/*', comment: 'Bestätigung und neues Passwort' }] }],
    },
  })
}
