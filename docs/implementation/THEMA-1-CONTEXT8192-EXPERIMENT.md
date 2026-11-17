# Thema 1: experimentelles Summary-Packing mit 8192

**Status: Entwurf zur Untersuchung, keine Produktionsfreigabe.**

Das bisherige 4096-Profil begrenzt die Q&A-Textprojektion des gemeinsamen
Referenz-Fixtures auf eine Quelle. Bei der separat untersuchten HTTP-Session
mit sechs Referenztexten und null Votes wurden sogar keine Quellen gepackt.
Diese beiden Fixtures sind nicht identisch.

Der Patch erhöht nur `modelProfile` und `contextWindowTokens` des
Summary-Packers auf 8192. Das konservative Zählverfahren über UTF-8-Bytes,
Ausgabereserve und Sicherheitsmarge bleiben unverändert. Der Regressionstest
prüft beim reichhaltigen Referenz-Fixture drei priorisierte Fragen sowie
zusätzliche Quellen, darunter ein Lernziel. Weitere Fragen werden weiterhin
explizit abgeschnitten; sechs Quellen insgesamt sind nicht sechs vollständig
repräsentierte Fragen. Ein weiterer Test erzwingt übergroße Metadaten und
prüft den Fallback auf sechs quellengebundene Q&A-Fragen in der reinen
Textprojektion. Das ist kein Nachweis für vollständig erhaltenen Vollkontext.

## Aktivierungsgrenzen

- Der kanonische `docker/open-weight-llm/entrypoint.sh` bleibt in diesem
  Experiment bei `--ctx-size 4096`. Vor einer Aktivierung muss das Runtime-
  und Packer-Budget zusammen entschieden und verifiziert werden. Diese
  Budgetdifferenz blockiert eine Produktionsübernahme dieses isolierten PRs.
- Die bestehenden Texte zur 4096-Q&A-Projektion und der Produktionshinweis
  in `.env.production.example` beschreiben noch den Ausgangsstand. Sie sind
  zusammen mit dem finalen Profilentscheid zu aktualisieren, nicht als
  Beschreibung eines bereits freigegebenen 8192-Betriebs zu lesen.
- Die Default-Flags bleiben aus. Kein Server, Modell oder Deployment wird
  durch diesen Patch gestartet oder verändert.
- Das App-Queue-Timeout bleibt standardmäßig 8000 ms. Ein größeres
  Packprofil verlängert dieses Budget nicht automatisch.

## Historischer Laborbefund und Reichweite

Die Messungen vom 13. November 2026 basieren auf Release v1.3.0, Commit
`87c39334619fbcb0c5782b061da1ba0df0ba3142`, nicht auf diesem PR-Head.
In einer kombinierten Variante mit passender 8192-Runtime sowie expliziten
180-s-Timeouts entstand ein Ergebnis mit sechs Quellen nach 123807 ms.
Mehrere Parameter wurden gemeinsam verändert; daraus folgt keine isolierte
Ursachenzuordnung und keine semantische Qualitätsbewertung.

Dieser Fork-PR überträgt den Packing-Anteil auf Fork-`main`. Die separate
Timeout-Untersuchung ist unabhängig. Ein gemeinsamer Mergevorschlag braucht
zusätzlich einen abgestimmten Runtime-Vertrag und weitere Kontrollen.
Die bestehenden Autorisierungs-, Quellenhash- und Fallback-Prüfungen werden
nicht gelockert. Rücknahme: diesen Commit zurücksetzen; anschließend sind
Packing-Profil und Fenster wieder 4096.
