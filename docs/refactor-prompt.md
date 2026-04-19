ich möchte das projket komplett refactoren und stark vereinfachen.

- Ich möchte alles rausnehmen was mit finanzen zu tun hatte.
- ziel ist es folgende 3 ansichten richtig zu haben:
   1. Regelbetrieb in dem für jede stunde, die die einrichtung offen ist die kapazität mit dem bedarf übereinander gelegt wird
   2. Historgram der Alter der Kinder in Monaten (3 Monatskategorien)
   3. Langzeit überblick
   4. Buchungsverteilung
- Beim Import soll der Status des Kindes gerüft werden. Nur Status "+" soll berücksichtigt werden (siehe beispiel xbase script:
declare function local:format-date($d as xs:string) as xs:date {
  let $p := tokenize(normalize-space($d), '\.')
  return xs:date(concat($p[3], '-', $p[2], '-', $p[1]))
};

declare function local:get-hours($zeitString as xs:string) as xs:double {
  let $safe := translate($zeitString, '|', ',')
  let $tage := tokenize($safe, '#')
  let $stundenListe := 
    for $t in $tage
    let $p := tokenize($t, ',')
    let $v := normalize-space($p[1])
    let $b := normalize-space($p[2])
    where contains($v, ':') and contains($b, ':')
    let $vH := xs:integer(substring-before($v, ':'))
    let $vM := xs:integer(substring-after($v, ':'))
    let $bH := xs:integer(substring-before($b, ':'))
    let $bM := xs:integer(substring-after($b, ':'))
    return (($bH * 60 + $bM) - ($vH * 60 + $vM)) div 60
  return sum($stundenListe)
};

let $stichtag := xs:date("2026-03-02")
let $db := db:open("kita-johannes-202602200811")

(: 1. Daten sammeln :)
let $alters_statistik := 
  for $k in $db//KIND
  let $kid := normalize-space($k/KINDNR)
  let $gebRaw := normalize-space($k/GEBDATUM)
  where $gebRaw != "" and $k/STATUS = "+"
  
  let $austrRaw := normalize-space($k/AUSTRDAT)
  where (empty($austrRaw) or $austrRaw = "" or local:format-date($austrRaw) > $stichtag)
  
  let $gebDate := local:format-date($gebRaw)
  let $monate := floor(days-from-duration($stichtag - $gebDate) div 30.4375)
  
  let $buchung := $db//BELEGUNGSBUCHUNG[
    normalize-space(KINDNR) = $kid and
    (normalize-space(BELVON) = "" or local:format-date(BELVON) <= $stichtag) and
    (normalize-space(BELBIS) = "" or local:format-date(BELBIS) >= $stichtag)
  ][1]
  
  let $wstd := if ($buchung/ZEITEN) then local:get-hours(string($buchung/ZEITEN)) else 0
  where $wstd > 0
  
  let $u_grenze := ($monate idiv 3) * 3
  return <kind 
            monate="{$monate}"
            kat="{$u_grenze}-{$u_grenze + 3} Monate" 
            stunden="{$wstd}" />

(: 2. CSV-Struktur aufbauen :)
let $csv_daten := <csv>
  <record>
    <Kategorie>Altersgruppe</Kategorie>
    <Anzahl_Kinder>Kinder</Anzahl_Kinder>
    <Wochenstunden>Gesamtstunden</Wochenstunden>
    <Status_Bayern>Typ</Status_Bayern>
  </record>
  {
    for $kat_label in distinct-values($alters_statistik/@kat)
    let $gruppe := $alters_statistik[@kat = $kat_label]
    let $monate_start := number(substring-before($kat_label, '-'))
    
    (: Bayern-Logik: Ab 72 Monaten Schulkind :)
    let $typ := if ($monate_start >= 72) then "Schulkind" else "Kita"
    
    order by $monate_start
    return <record>
      <Kategorie>{$kat_label}</Kategorie>
      <Anzahl_Kinder>{count($gruppe)}</Anzahl_Kinder>
      <Wochenstunden>{translate(string(sum($gruppe/@stunden)), '.', ',')}</Wochenstunden>
      <Status_Bayern>{$typ}</Status_Bayern>
    </record>
  }
</csv>

(: 3. Als CSV Text ausgeben (mit Semikolon für deutsches Excel) :)
return csv:serialize($csv_daten, map { 'separator': 'semicolon', 'header': true() })

)

- autogenierte Dates of interest: für jedes Kinde sollen die Gruppenwechsel (in Krippe und in Schulkind betreuung erstellt werden). diese Dates of interest sollen gesondert erkennbar sein. Sie sollen in die statistiken einfließen. es soll eine übersicht für die generierten Dates geben sodass man die auch einfach deaktiveren kann (einzeln)

- die UI soll auf Mantine UI umgestellt werden mit dem ziel die vielen zusätzlichen packete nicht mehr zu brauchen.

- das Projekt soll eine richtige Dokumentation readme und user doku bekommen

- die farben im diagramm brauchen mehr kontraste

- das projekt soll eine komplette test suite bekommen mit unit tests, regressions tests und e2e tests um die richtigkeit der importe, wirksamkeit der änderungen von daten, aufbau von szenarien und darstellung der diagramme abzusichern. end2end tests mit playwright.

- die arbeitszeiten blöcke der Mitarbeiter sollen in "Pädagogisch"(default) und Administrativ zugewiesen werden. nur die  Pädagogischen Zeiten sollen in den Betreuungsschlüssen gezählt werden.

- das projekt soll einen workflow erhalten mit dem releases auf github gebaut werden können. das release soll auch die seite als github page deployen



-----

Hast du Fragen zu dem großen umbau? Wenn nötig stelle mir klärungsfragen als auswahl (inkl. freitext option)
Wichtig ist dass er in einem eigenen branch entwickelt wird und erst wenn alles funktioniert mit main gemergt wird

Wenn dir die Anforderungen komplett klar sind. verfasse ein dokument mit dem refactor plan.
