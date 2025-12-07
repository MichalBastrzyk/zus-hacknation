import { z } from "zod"

export type AccidentCard = z.infer<typeof AccidentCardSchema>

export const AccidentCardSchema = z.object({
  // --- I. DANE IDENTYFIKACYJNE PŁATNIKA SKŁADEK ---
  employer: z.object({
    employer_name: z
      .string()
      .describe("Imię i nazwisko lub nazwa płatnika składek (pkt I.1)"),
    hq_address: z
      .string()
      .describe("Adres siedziby płatnika składek (pkt I.2)"),
    nip: z.string().describe("Numer NIP płatnika (pkt I.3)"),
    regon: z.string().describe("Numer REGON płatnika (pkt I.3)"),
    pesel: z
      .string()
      .describe(
        "Numer PESEL płatnika (pkt I.3) - wymagany, jeśli brak NIP/REGON"
      ),
    id: z
      .object({
        kind: z.enum(["dowód osobisty", "paszport"]),
        series: z.string(),
        number: z.string(),
      })
      .optional()
      .describe("Dane dokumentu tożsamości płatnika (rodzaj, seria, numer)"),
  }),

  // --- II. DANE IDENTYFIKACYJNE POSZKODOWANEGO ---
  injured: z.object({
    first_name: z.string().describe("Imię poszkodowanego (pkt II.1)"),
    last_name: z.string().describe("Nazwisko poszkodowanego (pkt II.1)"),
    pesel: z.string().describe("Numer PESEL poszkodowanego (pkt II.2)"),
    id: z
      .object({
        kind: z.enum(["dowód osobisty", "paszport"]),
        series: z.string(),
        number: z.string(),
      })
      .describe("Dokument tożsamości poszkodowanego (pkt II.2)"),
    birth: z.object({
      date: z.string().describe("Data urodzenia poszkodowanego (pkt II.3)"),
      place: z.string().describe("Miejsce urodzenia poszkodowanego (pkt II.3)"),
    }),
    address: z
      .string()
      .describe("Adres zamieszkania poszkodowanego (pkt II.4)"),
    // Pkt II.5 - Tytuł ubezpieczenia
    insurance_title: z
      .object({
        code: z
          .string()
          .describe(
            "Numer punktu z art. 3 ust. 3 (np. 'pkt 6' dla zleceniobiorcy)"
          ),
        description: z
          .string()
          .describe(
            "Pełny tytuł ubezpieczenia społecznego (np. 'wykonywanie pracy na podstawie umowy agencyjnej lub umowy zlecenia')"
          ),
      })
      .describe(
        "Tytuł ubezpieczenia wypadkowego zgodnie z art. 3 ust. 3 ustawy (pkt II.5)"
      ),
    is_student: z
      .boolean()
      .describe(
        "Czy poszkodowany jest uczniem/studentem (pomocnicze dla ustalenia tytułu)"
      ),
  }),

  // --- III. INFORMACJE O WYPADKU ---
  accident: z.object({
    date: z.string().describe("Data zgłoszenia wypadku (pkt III.1)"),
    reporters_first_name: z
      .string()
      .describe("Imię osoby zgłaszającej wypadek (pkt III.1)"),
    reporters_last_name: z
      .string()
      .describe("Nazwisko osoby zgłaszającej wypadek (pkt III.1)"),
    description: z
      .string()
      .describe(
        "Szczegółowe informacje dotyczące okoliczności, przyczyn, czasu i miejsca wypadku, rodzaju i umiejscowienia urazu (pkt III.2)"
      ),
    // Pkt III.4 - Kwalifikacja prawna
    legal_qualification: z.object({
      is_accident_at_work: z
        .boolean()
        .describe(
          "Czy zdarzenie JEST (true) czy NIE JEST (false) wypadkiem przy pracy (skreślenia w pkt III.4)"
        ),
      legal_basis: z
        .string()
        .describe(
          "Numer punktu z art. 3 ust. 3 (np. 'pkt 6') wpisany w kropki"
        ),
      justification: z
        .string()
        .describe(
          "Uzasadnienie kwalifikacji prawnej i wskazanie dowodów (pkt III.4)"
        ),
    }),
  }),

  // Pkt III.3 - Świadkowie
  witnesses: z
    .array(
      z.object({
        first_name: z.string().describe("Imię świadka"),
        last_name: z.string().describe("Nazwisko świadka"),
        address: z.string().describe("Miejsce zamieszkania świadka"),
      })
    )
    .optional()
    .describe("Lista świadków wypadku (pkt III.3)"),

  // Pkt III.5 (z poprzednich zdjęć) - Wina/Niedbalstwo
  accident_causes: z.object({
    negligence_statement: z
      .string()
      .optional()
      .describe(
        "Stwierdzenie dotyczące naruszenia przepisów/rażącego niedbalstwa (pkt III.5)"
      ),
  }),

  // Pkt III.6 - Nietrzeźwość
  sobriety: z.object({
    was_intoxicated: z
      .boolean()
      .describe(
        "Czy stwierdzono, że poszkodowany był w stanie nietrzeźwości/pod wpływem środków (pkt III.6)"
      ),
    evidence_description: z
      .string()
      .optional()
      .describe(
        "Opis dowodów na przyczynienie się do wypadku przez nietrzeźwość lub informacja o odmowie badania (pkt III.6)"
      ),
  }),

  // --- IV. POZOSTAŁE INFORMACJE ---
  meta_process: z.object({
    acknowledgment: z.object({
      person_name: z
        .string()
        .describe(
          "Imię i nazwisko poszkodowanego/członka rodziny podpisującego kartę (pkt IV.1)"
        ),
      date: z
        .string()
        .describe("Data zapoznania się z treścią karty (pkt IV.1)"),
    }),
    preparation: z.object({
      date: z.string().describe("Data sporządzenia karty wypadku (pkt IV.2)"),
      entity_name: z
        .string()
        .describe(
          "Nazwa podmiotu obowiązanego do sporządzenia karty (pkt IV.2.1)"
        ),
      preparer_name: z
        .string()
        .describe("Imię i nazwisko osoby sporządzającej kartę (pkt IV.2.2)"),
    }),
    delay_reason: z
      .string()
      .optional()
      .describe(
        "Przeszkody i trudności uniemożliwiające sporządzenie karty w terminie 14 dni (pkt IV.3)"
      ),
    receipt_date: z
      .string()
      .optional()
      .describe("Data odebrania karty (pkt IV.4)"),
    attachments: z.array(z.string()).describe("Lista załączników (pkt IV.5)"),
  }),
})

// if (!nip && !regon) {
//     return pesel
// }
