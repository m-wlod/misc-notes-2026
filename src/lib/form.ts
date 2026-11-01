/** A text field from FormData. Files (or a missing field) yield "", never "[object File]". */
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
