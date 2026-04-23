import React from 'react';
import { Header } from '../components/ui';

const IMPRESSUM_TEXT = `Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)

Lucas Wimmer Civico
Einzelunternehmen
Rheinstraße 26
64683 Einhausen
Deutschland

Kontakt
E-Mail: Lucaswimmer@mycivico.de
Telefon: 01626232262

Umsatzsteuer-ID
Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:
DE366832201

Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
Lucas Wimmer
Rheinstraße 26
64683 Einhausen`;

const AGB_TEXT = `1. Geltungsbereich
Diese Nutzungsbedingungen regeln die Nutzung der Plattform „Civico", betrieben von:
Lucas Wimmer / Civico
Rheinstraße 26
64683 Einhausen
Lucaswimmer@mycivico.de
Die Plattform richtet sich an:
- Gemeinden
- Vereine
- freiwillige Helfer

2. Leistungsbeschreibung
Civico ist eine digitale Plattform zur Organisation ehrenamtlicher Einsätze.
Die Plattform ermöglicht insbesondere:
- Erstellung und Verwaltung von Einsätzen
- Anmeldung von Helfern
- Kommunikation zwischen Nutzern
- statistische Auswertung von Aktivitäten
Ein Anspruch auf bestimmte Funktionen besteht nicht.

3. Registrierung und Nutzerkonto
Zur Nutzung bestimmter Funktionen ist eine Registrierung erforderlich.
Nutzer sind verpflichtet:
- wahrheitsgemäße Angaben zu machen
- ihre Zugangsdaten vertraulich zu behandeln
Ein Nutzerkonto ist nicht übertragbar.

4. Rollen und Verantwortlichkeiten
Die Plattform unterscheidet verschiedene Rollen:
- Gemeinde
- Verein
- freiwilliger Helfer
Vereine und Gemeinden sind selbst verantwortlich für:
- die Erstellung von Einsätzen
- die Organisation vor Ort
- die Richtigkeit der Inhalte
Civico übernimmt keine Verantwortung für die tatsächliche Durchführung von Einsätzen.

5. Anmeldung zu Einsätzen
Helfer können sich freiwillig zu Einsätzen anmelden.
Die Anmeldung stellt eine unverbindliche Teilnahmezusage dar. Die Durchführung liegt in der Verantwortung des jeweiligen Vereins oder der Gemeinde.

6. Verhalten der Nutzer
Nutzer verpflichten sich:
- keine falschen Angaben zu machen
- andere Nutzer nicht zu täuschen oder zu behindern
- keine rechtswidrigen Inhalte zu verbreiten
Missbrauch der Plattform kann zur Sperrung führen.

7. Kommunikation
Die Plattform kann Funktionen zur internen Kommunikation bereitstellen.
Nutzer sind verantwortlich für die Inhalte ihrer Nachrichten. Unzulässige Inhalte sind untersagt.

8. Verarbeitung und Darstellung von Daten
Im Rahmen der Nutzung werden Daten verarbeitet und teilweise innerhalb der Plattform sichtbar gemacht.
Dazu gehören insbesondere:
- Zuordnung zu Vereinen oder Gemeinden
- Anzeige von Teilnehmern an Einsätzen (zeitlich begrenzt)
Nach Abschluss eines Einsatzes werden personenbezogene Detaildaten reduziert dargestellt.

9. Statistische Auswertung
Civico verarbeitet Nutzungsdaten zur Erstellung von:
- statistischen Auswertungen
- Übersichten
- Berichten (z. B. CSR-Reports)
Diese Auswertungen erfolgen in aggregierter oder teilweise anonymisierter Form.

10. Verfügbarkeit der Plattform
Civico bemüht sich um eine möglichst hohe Verfügbarkeit der Plattform.
Ein Anspruch auf jederzeitige Verfügbarkeit besteht nicht.

11. Änderungen der Plattform
Civico behält sich vor:
- Funktionen anzupassen
- Inhalte zu ändern
- die Plattform weiterzuentwickeln

12. Haftung
Civico haftet nur für Schäden, die auf vorsätzlichem oder grob fahrlässigem Verhalten beruhen.
Für:
- Inhalte von Nutzern
- Durchführung von Einsätzen
- Verhalten von Teilnehmern
übernimmt Civico keine Haftung.

13. Sperrung und Kündigung
Civico kann Nutzerkonten sperren oder löschen, wenn:
- gegen diese Nutzungsbedingungen verstoßen wird
- ein Missbrauch der Plattform vorliegt

14. Datenschutz
Die Verarbeitung personenbezogener Daten erfolgt gemäß der Datenschutzerklärung.

15. Schlussbestimmungen
Es gilt das Recht der Bundesrepublik Deutschland.
Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt.`;

const DATENSCHUTZ_TEXT = `1. Verantwortlicher
Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO):
Lucas Wimmer / Civico
Rheinstraße 26
64683 Einhausen
Lucaswimmer@mycivico.de

2. Allgemeine Hinweise zur Datenverarbeitung
Wir verarbeiten personenbezogene Daten der Nutzer ausschließlich im Rahmen der gesetzlichen Bestimmungen der DSGVO.
Personenbezogene Daten sind alle Informationen, die sich auf eine identifizierte oder identifizierbare Person beziehen.

3. Hosting
Unsere Anwendung wird über den Anbieter Vercel bereitgestellt.
Dabei können technische Daten wie:
- IP-Adresse
- Zugriffsdaten
- Verbindungsdaten
verarbeitet werden.
Eine Datenübertragung in Drittländer (z. B. USA) kann nicht ausgeschlossen werden. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an stabiler und sicherer Bereitstellung der Plattform).

4. Domain-Hosting
Die Domain wird über IONOS bereitgestellt.
Dabei werden technische Verbindungsdaten verarbeitet.

5. Backend und Datenbank (Supabase)
Für die Bereitstellung unserer Plattform nutzen wir Supabase.
Dabei werden folgende Daten verarbeitet:
- Benutzerkonten (Name, E-Mail-Adresse)
- Einsätze und Teilnahmeinformationen
- Kommunikationsdaten (Nachrichten)
Die Verarbeitung erfolgt zur Bereitstellung der Plattformfunktionen gemäß Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).

6. Benutzerkonten
Bei der Registrierung werden folgende Daten erhoben:
- Name
- E-Mail-Adresse
Diese Daten werden verwendet zur:
- Erstellung und Verwaltung des Nutzerkontos
- Organisation von Einsätzen
- Kommunikation innerhalb der Plattform

7. Plattformfunktion und Datenweitergabe
Civico ist eine Plattform zur Organisation von ehrenamtlichen Einsätzen.
Dabei werden Daten zwischen Nutzern sichtbar gemacht, insbesondere:
- Zuordnung von Nutzern zu Vereinen oder Gemeinden
- Anzeige von angemeldeten Helfern für Einsätze (zeitlich begrenzt)
Nach Abschluss eines Einsatzes werden personenbezogene Detaildaten reduziert und nicht dauerhaft öffentlich angezeigt.

8. Verarbeitung von Verhaltensdaten
Im Rahmen der Nutzung der Plattform werden folgende Daten verarbeitet:
- Teilnahme an Einsätzen
- Absagen
- Nicht-Erscheinen (No-Show)
Diese Daten werden verwendet zur:
- Organisation von Einsätzen
- Verbesserung der Plattform
- Erstellung statistischer Auswertungen

9. Statistische Auswertungen und CSR-Berichte
Zur Analyse und Verbesserung der Plattform werden Daten in aggregierter Form ausgewertet.
Hierzu zählen insbesondere:
- Anzahl von Einsätzen
- Anzahl von Helfern
- Teilnahmequoten
- Gesamtstunden
Diese Auswertungen erfolgen in der Regel in aggregierter oder teilweise anonymisierter Form. Ein direkter Rückschluss auf einzelne Personen wird dabei soweit wie möglich vermieden.

10. Kommunikation innerhalb der Plattform
Die Plattform bietet Funktionen zur internen Kommunikation (z. B. Nachrichten zwischen Nutzern).
Dabei werden verarbeitet:
- Inhalte von Nachrichten
- Zeitpunkt der Kommunikation
- beteiligte Nutzer
Diese Daten werden zur Bereitstellung der Kommunikationsfunktion verarbeitet.

11. Push-Benachrichtigungen
Die Plattform kann Push-Benachrichtigungen versenden, z. B.:
- Erinnerungen an Einsätze
- organisatorische Hinweise
Bei Nutzung im Browser können hierfür technische Dienste des jeweiligen Browsers verwendet werden.
Bei zukünftiger Nutzung mobiler Anwendungen können Push-Dienste von Apple oder Google zum Einsatz kommen.

12. Speicherdauer
Personenbezogene Daten werden nur so lange gespeichert, wie dies für die jeweiligen Zwecke erforderlich ist.
Daten im Zusammenhang mit Einsätzen werden nach Abschluss reduziert oder aggregiert.

13. Rechte der betroffenen Personen
Nutzer haben das Recht auf:
- Auskunft (Art. 15 DSGVO)
- Berichtigung (Art. 16 DSGVO)
- Löschung (Art. 17 DSGVO)
- Einschränkung der Verarbeitung (Art. 18 DSGVO)
- Datenübertragbarkeit (Art. 20 DSGVO)

14. Widerspruchsrecht
Nutzer haben das Recht, der Verarbeitung ihrer Daten jederzeit zu widersprechen, sofern diese auf Art. 6 Abs. 1 lit. f DSGVO beruht.

15. Datensicherheit
Wir setzen technische und organisatorische Maßnahmen ein, um personenbezogene Daten vor Verlust, Manipulation und unberechtigtem Zugriff zu schützen.`;

function getLegalText(title, text) {
  if (title === 'Impressum') return IMPRESSUM_TEXT;
  if (title === 'Datenschutzerklärung') return DATENSCHUTZ_TEXT;
  if (title === 'AGB') return AGB_TEXT;
  return text || '';
}

function isHeading(line) {
  return /^\d+\./.test(line);
}

function isListItem(line) {
  return /^-\s/.test(line);
}

function isStandaloneSectionLabel(line) {
  return (
    !isHeading(line) &&
    !isListItem(line) &&
    [
      'Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)',
      'Kontakt',
      'Umsatzsteuer-ID',
      'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
    ].includes(line)
  );
}

function renderLine(line, key) {
  const heading = isHeading(line);
  const listItem = isListItem(line);
  const sectionLabel = isStandaloneSectionLabel(line);

  if (!line.trim()) {
    return <div key={key} style={{ height: 4 }} />;
  }

  if (line.includes('Lucaswimmer@mycivico.de')) {
    const parts = line.split('Lucaswimmer@mycivico.de');
    return (
      <div
        key={key}
        style={{
          fontSize: sectionLabel ? 14 : heading ? 14 : 13,
          fontWeight: sectionLabel || heading ? 'bold' : 'normal',
          color: sectionLabel || heading ? '#2C2416' : '#5C4A2A',
          lineHeight: 1.7,
          paddingLeft: listItem ? 6 : 0,
          wordBreak: 'break-word',
        }}
      >
        {listItem ? '• ' : ''}
        {parts[0].replace(/^E-Mail:\s*/, 'E-Mail: ')}
        <a
          href="mailto:Lucaswimmer@mycivico.de"
          style={{ color: '#B48A2C', textDecoration: 'none' }}
        >
          Lucaswimmer@mycivico.de
        </a>
        {parts[1]}
      </div>
    );
  }

  const content = listItem ? `• ${line.replace(/^-\s/, '')}` : line;

  return (
    <div
      key={key}
      style={{
        fontSize: sectionLabel ? 14 : heading ? 14 : 13,
        fontWeight: sectionLabel || heading ? 'bold' : 'normal',
        color: sectionLabel || heading ? '#2C2416' : '#5C4A2A',
        lineHeight: 1.7,
        paddingLeft: listItem ? 6 : 0,
        wordBreak: 'break-word',
      }}
    >
      {content}
    </div>
  );
}

function RechtlicheSeite({ title, text, onBack }) {
  const resolvedText = getLegalText(title, text);

  return (
    <div>
      <Header title={title} onBack={onBack} />
      <div style={{ padding: '20px 20px 60px' }}>
        {resolvedText.split('\n\n').map((para, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            {para.split('\n').map((line, j) => renderLine(line, `${i}-${j}`))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default RechtlicheSeite;
