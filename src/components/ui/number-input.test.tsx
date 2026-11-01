// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NumberInput } from "./number-input";

const messages = {
  ambiguous: "Niejednoznaczny zapis.",
  invalid: "Nie rozpoznaję tej liczby.",
  "division-by-zero": "Dzielenie przez zero.",
} as const;

function setup(defaultValue = "") {
  const onValueChange = vi.fn();
  render(
    <>
      <label htmlFor="n">Odpowiedź</label>
      <NumberInput
        id="n"
        defaultValue={defaultValue}
        aria-describedby="hint"
        onValueChange={onValueChange}
        invalidMessage={(r) => messages[r]}
      />
      <p id="hint">Podpowiedź</p>
    </>,
  );
  return { input: screen.getByLabelText("Odpowiedź"), onValueChange };
}

describe("NumberInput", () => {
  it("reports the parsed value on every change without rewriting the text", () => {
    const { input, onValueChange } = setup();
    fireEvent.change(input, { target: { value: "12,5%" } });
    expect(onValueChange).toHaveBeenLastCalledWith("12,5%", {
      ok: true,
      value: 0.125,
      kind: "percent",
    });
    expect(input).toHaveValue("12,5%");
  });

  it("does not flag invalid input while typing, only after blur", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).not.toHaveAttribute("aria-invalid");
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a text message linked via aria-describedby, not colour alone (review M7)", () => {
    const { input } = setup("1,000");
    fireEvent.blur(input);
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent(messages.ambiguous);
    expect(input.getAttribute("aria-describedby")?.split(" ")).toEqual(["hint", error.id]);
    expect(input).toHaveAccessibleDescription(`Podpowiedź ${messages.ambiguous}`);
  });

  it("clears the error as soon as the text becomes valid", () => {
    const { input } = setup("2x103");
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "2·10^3" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAttribute("aria-describedby", "hint");
  });

  it("treats an empty field as untouched, not invalid", () => {
    const { input } = setup();
    fireEvent.blur(input);
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("lets the caller override the width (review M2)", () => {
    render(<NumberInput aria-label="x" className="w-24" invalidMessage={(r) => messages[r]} />);
    const cls = screen.getByLabelText("x").className.split(" ");
    expect(cls).toContain("w-24");
    expect(cls).not.toContain("w-40");
    expect(cls).not.toContain("w-full");
  });
});
