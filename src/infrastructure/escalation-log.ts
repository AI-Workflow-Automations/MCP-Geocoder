import type { EscalationEntry, EscalationSink } from "../domain/ports.js";

/**
 * Eskalationen als strukturierte Zeilen auf stderr.
 *
 * stdout ist beim stdio-Transport das MCP-Protokoll - dort darf nichts anderes
 * landen. Die Zeilen sind JSON, damit sie sich später aus den Call-Logs
 * auswerten lassen: das ist die Baseline für jedes Messkriterium.
 */
export class StderrEscalationLog implements EscalationSink {
  record(entry: EscalationEntry): void {
    console.error(JSON.stringify({ event: "address_escalation", at: new Date().toISOString(), ...entry }));
  }
}

/** Für Tests und die Demo-Oberfläche: hält Eskalationen im Speicher. */
export class InMemoryEscalationLog implements EscalationSink {
  readonly entries: Array<EscalationEntry & { at: string }> = [];

  record(entry: EscalationEntry): void {
    this.entries.push({ at: new Date().toISOString(), ...entry });
  }
}
