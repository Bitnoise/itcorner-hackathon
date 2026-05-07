
## Kontekst
Wizyty u lekarzy specjalistów są nieefektywne ze względu na konieczność każdorazowego odtwarzania historii choroby oraz rozproszenie dokumentacji medycznej pacjenta. MedBridge adresuje ten problem, umożliwiając pacjentowi prowadzenie scentralizowanej dokumentacji i udostępnianie jej wybranym lekarzom podczas wizyty.

## Cel
Dostarczenie działającego prototypu end-to-end, który realizuje pełną ścieżkę zarządzania dokumentacją medyczną oraz wizytami lekarskimi pacjenta.
## Persony
* **Pacjent** - zarządza profilem zdrowotnym i dokumentacją, umawia wizyty, kontroluje udostępnianie danych, zapoznaje się z zaleceniami powizytowymi.

⠀
* **Lekarz** - przegląda harmonogram wizyt, analizuje udostępnioną dokumentację pacjenta, dokumentuje przebieg wizyty oraz wystawia zalecenia.

⠀Zakres funkcjonalny
### Uwierzytelnianie i autoryzacja
* **Logowanie** za pomocą adresu e-mail i hasła.
* **Kontrola dostępu**
  * Pacjent - dostęp wyłącznie do własnych danych oraz udostępnionych terminów wizyt lekarzy
  * Lekarz - dostęp do swoich wizyt oraz danych udostępnionych przez pacjenta

⠀Pacjent
* **Profil**: imię, nazwisko, data urodzenia, alergie, choroby przewlekłe, leki przyjmowane na stałe.
* **Dokumentacja medyczna**: pliki udostępniane wybranym lekarzom.
* **Umawianie wizyt**: wybór lekarza oraz dogodnego terminu.
* **Historia wizyt**: wgląd w pełne podsumowania zrealizowanych wizyt.

⠀Lekarz
* **Profil**: imię, nazwisko, specjalizacja, dostępne terminy wizyt.
* **Panel lekarza**: harmonogram umówionych wizyt wraz z podglądem danych udostępnionych przez pacjenta.
* **Podsumowanie wizyty**: rozpoznanie, zalecenia, przepisane leki oraz skierowania na badania.

⠀Założenia i ograniczenia
* Prototyp **nie podlega** rygorom zgodności z regulacjami, np. RODO czy HIPAA
* Brak rejestracji - wystarczy dostęp wyłącznie po zalogowaniu na podstawie przygotowanej bazy użytkowników
* Brak obsługi płatności w aplikacji
* Brak wysyłki wiadomości e-mail
* Jedna strefa czasowa i jeden język interfejsu (PL lub EN)
* Nie potrzebne jest środowisko produkcyjne. Prezentacja może odbyć się na środowisku lokalnym.

⠀Definition of Done
Dwóch użytkowników - w rolach pacjenta i lekarza - przechodzi przez cały proces: od logowania, przez konfigurację danych, udostępnienie dokumentów i rejestrację wizyty, aż po jej podsumowanie.
### Pacjent
**Przed wizytą:**
1. Logowanie do systemu jako pacjent
2. Edycja profilu pacjenta
3. Dodanie dokumentacji medycznej
4. Umówienie wizyty u lekarza (wybór lekarza i terminu)
5. Zgoda na udostępnienie danych lekarzowi

⠀
**Po wizycie:**
1. Dostęp do podsumowania wizyty

⠀Lekarz
**Przed wizytą:**
1. Logowanie do systemu jako lekarz
2. Edycja profilu lekarza
3. Udostępnienie terminów wizyt
4. Wyświetlenie harmonogramu umówionych wizyt
5. Podgląd danych oraz dokumentacji medycznej pacjenta

⠀
**Po wizycie:**
1. Dodanie podsumowania wizyty
