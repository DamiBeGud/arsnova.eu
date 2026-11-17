# Thema 1: explizite Summary-Timeouts bis 180 Sekunden

**Status: experimenteller Konfigurationsrahmen, keine Produktionsfreigabe.**

Ein echter CPU-Summary-Lauf benötigte im untersuchten Labor ungefähr zwei
Minuten. Der Parser akzeptiert bisher maximal 30000 ms, während der
Default bei 8000 ms liegt. Dieser Patch hebt ausschließlich die zulässige
Obergrenze auf 180000 ms an. Default, Untergrenze, Queue-Limit, Parallelität,
Feature-Flags und Berechtigungsprüfungen bleiben unverändert.

Die Unit-Tests prüfen den unveränderten 8000-ms-Default, die Untergrenze,
die bisherige Grenze, 90000 und 180000 ms sowie die Ablehnung größerer Werte.
Die Queue-Suite prüft weiterhin Timeout, Abbruch und Quellenänderungen mit
kurzen injizierten Testprozessoren; sie ist kein echter 180-s-Modelltest.

## Konfiguration und Betriebsgrenzen

Die zulässige Obergrenze ist keine automatische Aktivierung. Ein expliziter
Laborlauf kann `QA_SUMMARY_TIMEOUT_MS=180000` verwenden. Das unabhängige
Adapter-Budget `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS` muss ebenfalls passend
gewählt werden; sein bisheriger Beispielwert beträgt 90000 ms. Die produktive
Beispielkonfiguration behält `QA_SUMMARY_TIMEOUT_MS=8000` und deaktivierte
Feature-Flags. Der Patch ändert weder diese Werte noch Deployment-Dateien.

Längere Fristen können den einzigen Modellslot und die App-Queue länger
belegen. Ergebnisalterung, Busy-Ablehnungen und Abbruchverhalten sind vor
einer Produktionsübernahme gesondert zu prüfen. Die reale Slot-Freigabe nach
Abbruch ist noch nicht explizit vermessen. Quellenhash-Revalidierung darf
nicht zugunsten einer hohen Erfolgsquote gelockert werden.

## Historischer Laborbefund

Der reale Lauf vom 13. November 2026 verwendete Release v1.3.0, Commit
`87c39334619fbcb0c5782b061da1ba0df0ba3142`, eine separate 8192-Packvariante,
eine passende CPU-Runtime und 180-s-Queue-/Adapter-Budgets. Die Anwendung
lieferte sechs quellengebundene Aussagen nach 123807 ms. Dies ist kein
Benchmark dieses PR-Heads und kein isolierter Beweis für einen Timeout-Effekt.

Dieser PR bleibt unabhängig vom größeren Packing-Profil. Beide Änderungen
zusammen ersetzen weder die Runtime-Abstimmung noch eine Qualitäts- und
Kapazitätsbewertung. Ein Rollback setzt die Obergrenze auf 30000 ms zurück;
vorher müssen Betreiber gegebenenfalls konfigurierte höhere Werte wieder
in den alten Bereich bringen, sonst schlägt die Konfigurationsprüfung fehl.
