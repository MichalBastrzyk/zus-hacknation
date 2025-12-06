import { sqliteTable, text, integer, blob, real } from "drizzle-orm/sqlite-core"
import { relations, sql } from "drizzle-orm"
import { AccidentDecision } from "@/lib/validators"

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .$onUpdateFn(() => new Date())
    .notNull(),
}

// ============ ENUMS (as text with enum constraint in SQLite) ============

export const ACCIDENT_TYPES = [
  "przy_pracy",
  "w_drodze_do_pracy",
  "w_drodze_z_pracy",
] as const

export const ACCIDENT_SEVERITIES = [
  "lekki",
  "ciezki",
  "smiertelny",
  "zbiorowy",
] as const

export const REPORT_STATUSES = [
  "szkic",
  "zlozony",
  "zaakceptowany",
  "odrzucony",
] as const

// ============ TABLES ============

export const employers = sqliteTable("employers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  nip: text("nip", { length: 10 }).notNull().unique(),
  companyName: text("company_name", { length: 500 }).notNull(),
  address: text("address"),
  phone: text("phone", { length: 20 }),
  email: text("email", { length: 255 }),
  ...timestamps,
})

export const injuredPersons = sqliteTable("injured_persons", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  pesel: text("pesel", { length: 11 }).notNull(),
  firstName: text("first_name", { length: 100 }).notNull(),
  lastName: text("last_name", { length: 100 }).notNull(),
  dateOfBirth: text("date_of_birth"),
  address: text("address"),
  phone: text("phone", { length: 20 }),
  email: text("email", { length: 255 }),
  employerId: text("employer_id").references(() => employers.id),
  position: text("position", { length: 200 }),
  ...timestamps,
})

export const accidents = sqliteTable("accidents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  injuredPersonId: text("injured_person_id")
    .references(() => injuredPersons.id)
    .notNull(),
  employerId: text("employer_id")
    .references(() => employers.id)
    .notNull(),
  accidentType: text("accident_type", { enum: ACCIDENT_TYPES }).notNull(),
  accidentSeverity: text("accident_severity", {
    enum: ACCIDENT_SEVERITIES,
  }).notNull(),
  accidentDate: text("accident_date").notNull(),
  accidentTime: text("accident_time", { length: 8 }),
  accidentPlace: text("accident_place").notNull(),
  accidentDescription: text("accident_description").notNull(),
  accidentCause: text("accident_cause"),
  status: text("status", { enum: REPORT_STATUSES }).default("szkic").notNull(),
  ...timestamps,
})

type AttachedDocument = {
  name: string
  hash: string
}

export const analysis = sqliteTable("analysis", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // accidentId: text("accident_id")
  //   .references(() => accidents.id)
  //   .notNull(),
  decision: text("decision").$type<
    "APPROVED" | "REJECTED" | "NEEDS_CLARIFICATION"
  >(),
  confidenceLevel: real("confidence_level").notNull(),
  criteriaAnalysis: blob({ mode: "json" })
    .$type<AccidentDecision["criteria_analysis"]>()
    .notNull(),
  identifiedFlaws: blob({ mode: "json" })
    .$type<AccidentDecision["identified_flaws"]>()
    .notNull(),
  suggestedFollowUpQuestions: blob({ mode: "json" })
    .$type<AccidentDecision["suggested_follow_up_questions"]>()
    .notNull(),
  attachedDocuments: blob({ mode: "json" })
    .$type<AttachedDocument[] | null>()
    .default(null),
  attachedDocumentsHash: text("attached_documents_hash", {
    length: 128,
  }).notNull(),
  ...timestamps,
})

export const witnesses = sqliteTable("witnesses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accidentId: text("accident_id")
    .references(() => accidents.id)
    .notNull(),
  firstName: text("first_name", { length: 100 }).notNull(),
  lastName: text("last_name", { length: 100 }).notNull(),
  phone: text("phone", { length: 20 }),
  statement: text("statement"),
  ...timestamps,
})

// ============ RELATIONS ============

export const employersRelations = relations(employers, ({ many }) => ({
  injuredPersons: many(injuredPersons),
  accidents: many(accidents),
}))

export const injuredPersonsRelations = relations(
  injuredPersons,
  ({ one, many }) => ({
    employer: one(employers, {
      fields: [injuredPersons.employerId],
      references: [employers.id],
    }),
    accidents: many(accidents),
  })
)

export const accidentsRelations = relations(accidents, ({ one, many }) => ({
  injuredPerson: one(injuredPersons, {
    fields: [accidents.injuredPersonId],
    references: [injuredPersons.id],
  }),
  employer: one(employers, {
    fields: [accidents.employerId],
    references: [employers.id],
  }),
  witnesses: many(witnesses),
}))

export const witnessesRelations = relations(witnesses, ({ one }) => ({
  accident: one(accidents, {
    fields: [witnesses.accidentId],
    references: [accidents.id],
  }),
}))
