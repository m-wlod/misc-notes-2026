"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, RadioGroup, RadioItem } from "@/components/ui/choice";
import { FieldHint, Label, Textarea, Input } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipProvider,
} from "@/components/ui/overlays";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toast, ToastProvider } from "@/components/ui/toast";
import { parseLocaleNumber, type ParseNumberResult } from "@/lib/math/parse-number";

// Style guide sample copy is Polish on purpose: it is what users will see.
// Phase 2 moves real UI strings into next-intl messages.

const fmt = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 6 });

function describe(parsed: ParseNumberResult | null): string {
  if (!parsed) return "—";
  if (!parsed.ok) return `błąd: ${parsed.reason}`;
  return `${fmt.format(parsed.value)} (${parsed.kind})`;
}

export function FieldDemos() {
  const [parsed, setParsed] = useState<ParseNumberResult | null>(() => parseLocaleNumber("0,25"));
  return (
    <div className="grid max-w-xl gap-6">
      <div className="grid gap-1.5">
        <Label htmlFor="sg-number">Odpowiedź liczbowa</Label>
        <NumberInput
          id="sg-number"
          defaultValue="0,25"
          aria-describedby="sg-number-hint"
          onValueChange={(_raw, p) => {
            setParsed(p);
          }}
        />
        <FieldHint id="sg-number-hint">
          Przyjmuje 0,25 · 0.25 · 12,5% · 3/8 · 1e-3. Odczyt:{" "}
          <span className="num">{describe(parsed)}</span>
        </FieldHint>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sg-input">Nazwa wyświetlana</Label>
        <Input id="sg-input" placeholder="np. kwant_z_krakowa" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sg-textarea">Uzasadnienie</Label>
        <Textarea id="sg-textarea" placeholder="Dlaczego wynik jest istotny statystycznie?" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sg-select">Poziom</Label>
        <Select
          id="sg-select"
          defaultValue="2"
          options={[
            { value: "1", label: "1 · Podstawy" },
            { value: "2", label: "2 · Średnio" },
            { value: "3", label: "3 · Trudno" },
            { value: "4", label: "4 · Ekstremalnie" },
            { value: "5", label: "5 · Quant Trader" },
          ]}
        />
      </div>
      <div className="flex items-center gap-2.5">
        <Checkbox id="sg-check" defaultChecked />
        <Label htmlFor="sg-check" className="font-normal">
          Pokaż rozwiązania po pierwszej próbie
        </Label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Dzienny cel</legend>
        <RadioGroup defaultValue="10" aria-label="Dzienny cel">
          {["5", "10", "20"].map((m) => (
            <div key={m} className="flex items-center gap-2.5">
              <RadioItem value={m} id={`sg-goal-${m}`} />
              <Label htmlFor={`sg-goal-${m}`} className="font-normal">
                {m} min dziennie
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
    </div>
  );
}

export function TabDemos() {
  return (
    <div className="grid gap-8">
      <Tabs defaultValue="formal">
        <TabsList variant="segmented" aria-label="Głębokość wyjaśnienia">
          <TabsTrigger value="easy">Po ludzku</TabsTrigger>
          <TabsTrigger value="formal">Podręcznik</TabsTrigger>
        </TabsList>
        <TabsContent value="easy" className="font-serif text-reading">
          Średni wynik może być dodatni, a i tak tracisz pieniądze, bo straty bolą bardziej niż
          zyski pomagają.
        </TabsContent>
        <TabsContent value="formal" className="font-serif text-reading">
          Wzrost geometryczny jest niższy od średniej arytmetycznej o połowę wariancji: g ≈ μ −
          σ²/2.
        </TabsContent>
      </Tabs>
      <Tabs defaultValue="lessons">
        <TabsList aria-label="Sekcje">
          <TabsTrigger value="lessons">Lekcje</TabsTrigger>
          <TabsTrigger value="exercises">Zadania</TabsTrigger>
          <TabsTrigger value="debunk">Debunk</TabsTrigger>
        </TabsList>
        <TabsContent value="lessons" className="text-sm text-ink-muted">
          12 lekcji w module.
        </TabsContent>
        <TabsContent value="exercises" className="text-sm text-ink-muted">
          60 zadań na 5 poziomach.
        </TabsContent>
        <TabsContent value="debunk" className="text-sm text-ink-muted">
          3 powiązane mity.
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function OverlayDemos() {
  const [toastOpen, setToastOpen] = useState(false);
  return (
    <TooltipProvider>
      <ToastProvider label="Powiadomienia">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Pokaż rozwiązanie</Button>
            </DialogTrigger>
            <DialogContent
              title="Rozwiązanie"
              description="Pokazanie rozwiązania odejmuje połowę punktów za to zadanie."
              closeLabel="Zamknij"
            >
              <p className="mb-6 font-serif text-reading">1 / (1 − 0,2) − 1 = 0,25, czyli 25%.</p>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Anuluj</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Pokaż</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">Martyngał</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className="mb-1 font-medium">Martyngał</p>
              <p className="text-ink-muted">
                Proces, którego oczekiwana przyszła wartość równa się obecnej. Gra uczciwa: bez
                przewagi.
              </p>
            </PopoverContent>
          </Popover>

          <Tooltip content="Podpowiedź kosztuje 2 XP">
            <Button variant="ghost">Podpowiedź</Button>
          </Tooltip>

          <Button
            onClick={() => {
              setToastOpen(false);
              window.setTimeout(() => {
                setToastOpen(true);
              }, 50);
            }}
          >
            Zapisz notatkę
          </Button>
        </div>
        <Toast
          open={toastOpen}
          onOpenChange={setToastOpen}
          title="Notatka zapisana"
          description="Znajdziesz ją w zakładce Moje notatki."
          tone="correct"
          closeLabel="Zamknij"
        />
      </ToastProvider>
    </TooltipProvider>
  );
}
