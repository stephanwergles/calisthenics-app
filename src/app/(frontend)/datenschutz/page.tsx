/* Datenschutzerklärung – ENTWURF. Platzhalter [ … ] füllen und vor dem Store-Release
   rechtlich prüfen lassen. Textversion der Einwilligung: src/core/consent.ts. */
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Datenschutz · Lever' }

export default function Datenschutz() {
  return (
    <main className="legal">
      <p className="legal-draft">Entwurf – noch nicht rechtlich geprüft</p>
      <h1 className="display">Datenschutz</h1>

      <h2>Verantwortlich</h2>
      <p>[Firma, Anschrift, E-Mail für Datenschutzanfragen]</p>

      <h2>Grundsatz: Deine Daten bleiben auf deinem Gerät</h2>
      <p>Lever funktioniert ohne Konto. Trainingsdaten (Einheiten, Sätze, Notizen, Cardio, Trainingsstand) speichert die App
        dann ausschließlich lokal auf deinem Gerät. Wir erhalten davon nichts.</p>

      <h2>Konto und Abgleich (optional)</h2>
      <p>Wenn du dich anmeldest und einwilligst, speichern wir deine Trainingsdaten auf unserem Server, um sie zu sichern und
        zwischen deinen Geräten abzugleichen. Dazu gehören E-Mail-Adresse, Passwort (nur als Hash), Einheiten mit Sätzen und
        Notizen, Cardio-Einträge und dein Trainingsstand.</p>
      <p>Trainingsdaten können Rückschlüsse auf deine Gesundheit zulassen. Wir verarbeiten sie deshalb nur auf Grundlage deiner
        ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO), die Konto-Daten zur Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
        Gespeichert werden Textfassung und Zeitpunkt deiner Einwilligung.</p>

      <h2>Anmeldung mit Apple</h2>
      <p>Meldest du dich mit „Mit Apple anmelden“ an, übermittelt Apple uns eine Kennung deiner Apple-ID und deine
        E-Mail-Adresse (auf Wunsch eine anonyme Weiterleitungsadresse von Apple). Wir speichern beides nur zur Anmeldung.</p>

      <h2>E-Mails</h2>
      <p>Bestätigungs- und Passwort-Mails versenden wir über [Resend, Inc., USA – Auftragsverarbeitung, Standardvertragsklauseln].
        Dabei werden deine E-Mail-Adresse und der Inhalt der Mail übermittelt.</p>

      <h2>Server</h2>
      <p>[Hosting-Anbieter, Standort/Land, Auftragsverarbeitungsvertrag]. Verbindungen sind per HTTPS verschlüsselt.
        Server-Protokolle (IP-Adresse, Zeitpunkt, angefragte Adresse) werden [Dauer] aufbewahrt.</p>

      <h2>Keine Werbung, kein Tracking</h2>
      <p>Lever nutzt keine Werbe- oder Tracking-Dienste und gibt keine Daten an Dritte weiter. Übungsvideos auf YouTube öffnen
        sich nur auf deinen Wunsch in YouTube.</p>

      <h2>Widerruf, Löschung, Auskunft</h2>
      <p>Du kannst die Einwilligung jederzeit widerrufen: Abmelden beendet den Abgleich, „Daten → Konto löschen“ entfernt Konto und
        alle Trainingsdaten sofort vom Server. Einen Export deiner Daten erstellt die App unter „Daten → Export“.
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Beschwerde bei einer
        Aufsichtsbehörde.</p>

      <p className="legal-meta">Stand: [Datum]</p>
    </main>
  )
}
