
# Projekt na ćwiczenia z Sztucznej Inteligencji (min-max)

Przygotował Patryk Ludwikowski.



### Założenia

* Gracze naprzemiennie wykonują swoje ruchy (tak jak w grze kółko-krzyżyk) ale na planszy umieszczają tylko po 3 znaki. 
* W ostatnim ruchu każdy z graczy musi przesunąć swój znak na wolne pole. Ten ruch może się odbyć tylko w pionie lub poziomie. _Nie jest określony zasięg albo czy można "przeskoczyć" inny znak - zakładam, że tak._
* Wygrywa ten, kto umieści swoje 3 znaki w jednej linii (jak w grze w kółko-krzyżyk).



### Inne pomysły

_Różne ciekawe luźne pomysły, które można byłoby zaimplementować dla praktyki, ale są generalnie poza założeniami projektu..._

+ Uczynić grę grywalną na urządzeniach dotykowych.
+ Sztuczna inteligencja:
	+ Naiwne strategia:
		+ jeśli jakiś ruch wygrywający, wybierz.
		+ jeśli jakiś ruch umożliwia przegranie w następnej turze, staraj się nie wybrać.
		+ w ostateczności: losuj ruch.
	+ Transpozycje/haszowanie (Zobrist?) w celu unikania powtórzeń.
	+ Dynamiczne transpozycje (dla symetrycznych/obróconych stanów).
	+ Heurystyka i `beam-search` zamiast rozwijania pełnego grafu.
	+ Ustawienia:
		+ szansa na losowy ruch komputera (ułatwienie).
+ Kontrolki pozwalające modyfikować ustawienia:
	+ wymiary planszy,
	+ liczba ustawień znaków, 
	+ liczba przesunięć znaków,
	+ możliwe osie przesuwania,
	+ liczba przesunięć na znak,
	+ kolejność faz (ustawianie/przesuwanie/dowolne),
	+ liczba graczy,
+ Inne elementy interfejsu:
	+ statystyki wygranych/przegranych,
+ Serwer i klient (WebSockets API).
+ ...


