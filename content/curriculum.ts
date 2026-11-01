/**
 * The curriculum outline: tracks → modules → ordered lesson ids. Lesson details (title,
 * summary, level, prerequisites, minutes) live in each lesson's frontmatter.
 * Order here is the textbook order and drives numbering (track n, module n.m, lesson n.m.k).
 * Validated at content build: every id needs a Polish lesson file, every lesson appears
 * once, and prerequisites must come earlier in this order.
 */
import type { Curriculum } from "../src/features/curriculum/schema";

export const curriculum = [
  {
    id: "foundations",
    slug: {
      pl: "fundamenty",
      en: "foundations",
    },
    name: {
      pl: "Fundamenty",
      en: "Foundations",
    },
    description: {
      pl: "Procenty, logarytmy i stopy zwrotu: rachunki, na których opiera się cała reszta.",
      en: "Percentages, logarithms and returns: the arithmetic everything else is built on.",
    },
    modules: [
      {
        id: "returns",
        slug: {
          pl: "stopy-zwrotu",
          en: "returns",
        },
        name: {
          pl: "Stopy zwrotu i procent składany",
          en: "Returns and compounding",
        },
        lessons: ["percentages-compounding", "exp-log", "log-returns", "drawdown-recovery"],
      },
      {
        id: "toolkit",
        slug: {
          pl: "narzedzia",
          en: "toolkit",
        },
        name: {
          pl: "Narzędzia matematyczne",
          en: "Math toolkit",
        },
        lessons: ["sums-series", "functions-derivatives"],
      },
    ],
  },
  {
    id: "probability",
    slug: {
      pl: "prawdopodobienstwo",
      en: "probability",
    },
    name: {
      pl: "Kombinatoryka i prawdopodobieństwo",
      en: "Combinatorics and probability",
    },
    description: {
      pl: "Zliczanie, prawdopodobieństwo warunkowe i wzór Bayesa, czyli język niepewności.",
      en: "Counting, conditional probability and Bayes' rule: the language of uncertainty.",
    },
    modules: [
      {
        id: "counting",
        slug: {
          pl: "zliczanie",
          en: "counting",
        },
        name: {
          pl: "Zliczanie i podstawy",
          en: "Counting and basics",
        },
        lessons: ["counting", "probability-basics", "random-variables"],
      },
      {
        id: "conditional",
        slug: {
          pl: "warunkowe",
          en: "conditional",
        },
        name: {
          pl: "Prawdopodobieństwo warunkowe",
          en: "Conditional probability",
        },
        lessons: ["conditional-probability", "independence", "bayes", "probability-paradoxes"],
      },
    ],
  },
  {
    id: "expected-value",
    slug: {
      pl: "wartosc-oczekiwana",
      en: "expected-value",
    },
    name: {
      pl: "Wartość oczekiwana i zakłady",
      en: "Expected value and betting",
    },
    description: {
      pl: "Ile średnio zyskujesz, jak bardzo wyniki się wahają i ile postawić.",
      en: "What you win on average, how much outcomes swing, and how much to bet.",
    },
    modules: [
      {
        id: "ev-basics",
        slug: {
          pl: "podstawy",
          en: "basics",
        },
        name: {
          pl: "Wartość oczekiwana",
          en: "Expected value",
        },
        lessons: ["expected-value", "variance-outcomes"],
      },
      {
        id: "betting",
        slug: {
          pl: "zaklady",
          en: "betting",
        },
        name: {
          pl: "Zakłady i wielkość stawki",
          en: "Betting and bet sizing",
        },
        lessons: ["gamblers-ruin", "martingale-betting", "kelly-criterion", "risk-of-ruin"],
      },
    ],
  },
  {
    id: "statistics",
    slug: {
      pl: "statystyka",
      en: "statistics",
    },
    name: {
      pl: "Statystyka i testowanie hipotez",
      en: "Statistics and hypothesis testing",
    },
    description: {
      pl: "Co naprawdę mówią dane i dlaczego większość backtestów kłamie.",
      en: "What data really tells you, and why most backtests lie.",
    },
    modules: [
      {
        id: "estimation",
        slug: {
          pl: "estymacja",
          en: "estimation",
        },
        name: {
          pl: "Estymacja",
          en: "Estimation",
        },
        lessons: ["estimators", "central-limit-theorem", "confidence-intervals"],
      },
      {
        id: "testing",
        slug: {
          pl: "testowanie",
          en: "testing",
        },
        name: {
          pl: "Testowanie hipotez",
          en: "Hypothesis testing",
        },
        lessons: [
          "p-values",
          "multiple-testing",
          "overfitting",
          "why-backtests-lie",
          "deflated-sharpe",
        ],
      },
    ],
  },
  {
    id: "linear-algebra",
    slug: {
      pl: "algebra-liniowa",
      en: "linear-algebra",
    },
    name: {
      pl: "Algebra liniowa dla quanta",
      en: "Linear algebra for quants",
    },
    description: {
      pl: "Wektory i macierze jako język portfeli, kowariancji i redukcji wymiaru.",
      en: "Vectors and matrices as the language of portfolios, covariance and dimension reduction.",
    },
    modules: [
      {
        id: "matrices",
        slug: {
          pl: "wektory-i-macierze",
          en: "vectors-and-matrices",
        },
        name: {
          pl: "Wektory i macierze",
          en: "Vectors and matrices",
        },
        lessons: ["vectors-matrices", "covariance-matrices", "portfolio-variance"],
      },
      {
        id: "decompositions",
        slug: {
          pl: "rozklady-macierzy",
          en: "decompositions",
        },
        name: {
          pl: "Rozkłady macierzy",
          en: "Matrix decompositions",
        },
        lessons: ["eigendecomposition", "pca"],
      },
    ],
  },
  {
    id: "time-series",
    slug: {
      pl: "szeregi-czasowe",
      en: "time-series",
    },
    name: {
      pl: "Szeregi czasowe",
      en: "Time series",
    },
    description: {
      pl: "Dane uporządkowane w czasie: stacjonarność, autokorelacja i zmienność.",
      en: "Data ordered in time: stationarity, autocorrelation and volatility.",
    },
    modules: [
      {
        id: "dependence",
        slug: {
          pl: "zaleznosc-w-czasie",
          en: "dependence-over-time",
        },
        name: {
          pl: "Zależność w czasie",
          en: "Dependence over time",
        },
        lessons: ["stationarity", "autocorrelation", "arima", "cointegration"],
      },
      {
        id: "volatility",
        slug: {
          pl: "zmiennosc",
          en: "volatility",
        },
        name: {
          pl: "Zmienność",
          en: "Volatility",
        },
        lessons: ["volatility-clustering", "garch"],
      },
    ],
  },
  {
    id: "random-walks",
    slug: {
      pl: "bladzenie-losowe",
      en: "random-walks",
    },
    name: {
      pl: "Błądzenie losowe i ruch Browna",
      en: "Random walks and Brownian motion",
    },
    description: {
      pl: "Od rzutu monetą do ciągłego modelu ceny akcji.",
      en: "From coin flips to a continuous model of a stock price.",
    },
    modules: [
      {
        id: "walks",
        slug: {
          pl: "bladzenie-losowe",
          en: "random-walks",
        },
        name: {
          pl: "Błądzenie losowe",
          en: "Random walks",
        },
        lessons: ["random-walk", "efficient-markets", "brownian-motion", "gbm"],
      },
    ],
  },
  {
    id: "stochastic-calculus",
    slug: {
      pl: "rachunek-stochastyczny",
      en: "stochastic-calculus",
    },
    name: {
      pl: "Rachunek stochastyczny",
      en: "Stochastic calculus",
    },
    description: {
      pl: "Całka i lemat Itô na intuicjach, bez zbędnego formalizmu.",
      en: "The Itô integral and Itô's lemma, built on intuition rather than formalism.",
    },
    modules: [
      {
        id: "ito",
        slug: {
          pl: "rachunek-ito",
          en: "ito-calculus",
        },
        name: {
          pl: "Rachunek Itô",
          en: "Itô calculus",
        },
        lessons: ["ito-integral", "ito-lemma", "sdes", "volatility-drag"],
      },
    ],
  },
  {
    id: "fourier",
    slug: {
      pl: "fourier",
      en: "fourier",
    },
    name: {
      pl: "Fourier i sygnały",
      en: "Fourier and signals",
    },
    description: {
      pl: "Rozkład sygnału na częstotliwości i dlaczego „cykle rynkowe” to zwykle szum.",
      en: "Breaking a signal into frequencies, and why “market cycles” are usually noise.",
    },
    modules: [
      {
        id: "spectral",
        slug: {
          pl: "analiza-czestotliwosci",
          en: "frequency-analysis",
        },
        name: {
          pl: "Analiza częstotliwości",
          en: "Frequency analysis",
        },
        lessons: ["fourier-series", "fourier-transform", "spectral-analysis", "market-cycles"],
      },
    ],
  },
  {
    id: "options",
    slug: {
      pl: "opcje",
      en: "options",
    },
    name: {
      pl: "Wycena opcji",
      en: "Option pricing",
    },
    description: {
      pl: "Od wypłaty opcji do modelu Blacka–Scholesa i greckich współczynników.",
      en: "From option payoffs to the Black–Scholes model and the Greeks.",
    },
    modules: [
      {
        id: "option-basics",
        slug: {
          pl: "podstawy-opcji",
          en: "option-basics",
        },
        name: {
          pl: "Podstawy opcji",
          en: "Option basics",
        },
        lessons: ["option-payoffs", "put-call-parity"],
      },
      {
        id: "pricing-models",
        slug: {
          pl: "modele-wyceny",
          en: "pricing-models",
        },
        name: {
          pl: "Modele wyceny",
          en: "Pricing models",
        },
        lessons: ["binomial-model", "black-scholes", "greeks", "implied-volatility"],
      },
    ],
  },
  {
    id: "microstructure",
    slug: {
      pl: "mikrostruktura",
      en: "microstructure",
    },
    name: {
      pl: "Mikrostruktura rynku",
      en: "Market microstructure",
    },
    description: {
      pl: "Jak naprawdę zawiera się transakcje: arkusz zleceń, spread i koszty.",
      en: "How trades actually happen: the order book, the spread and the costs.",
    },
    modules: [
      {
        id: "trading-mechanics",
        slug: {
          pl: "mechanika-handlu",
          en: "trading-mechanics",
        },
        name: {
          pl: "Mechanika handlu",
          en: "Trading mechanics",
        },
        lessons: ["order-book", "bid-ask-spread", "slippage-costs", "market-making"],
      },
    ],
  },
  {
    id: "risk",
    slug: {
      pl: "ryzyko",
      en: "risk",
    },
    name: {
      pl: "Ryzyko i wielkość pozycji",
      en: "Risk and position sizing",
    },
    description: {
      pl: "Miary ryzyka, dobór wielkości pozycji i co się dzieje w kryzysie.",
      en: "Risk measures, position sizing, and what happens in a crisis.",
    },
    modules: [
      {
        id: "risk-measures",
        slug: {
          pl: "miary-ryzyka",
          en: "risk-measures",
        },
        name: {
          pl: "Miary ryzyka",
          en: "Risk measures",
        },
        lessons: ["value-at-risk", "expected-shortfall"],
      },
      {
        id: "sizing",
        slug: {
          pl: "wielkosc-pozycji",
          en: "position-sizing",
        },
        name: {
          pl: "Wielkość pozycji",
          en: "Position sizing",
        },
        lessons: ["position-sizing", "leverage", "crisis-correlation"],
      },
    ],
  },
  {
    id: "puzzles",
    slug: {
      pl: "lamiglowki",
      en: "puzzles",
    },
    name: {
      pl: "Łamigłówki quanta",
      en: "Quant puzzles",
    },
    description: {
      pl: "Zadania z rozmów rekrutacyjnych: rachunek w pamięci, szacowanie i łamigłówki.",
      en: "Interview problems: mental maths, estimation and brainteasers.",
    },
    modules: [
      {
        id: "interview",
        slug: {
          pl: "rozmowa-rekrutacyjna",
          en: "interview-practice",
        },
        name: {
          pl: "Przygotowanie do rozmowy",
          en: "Interview practice",
        },
        lessons: ["mental-math", "estimation-fermi", "brainteasers"],
      },
    ],
  },
] satisfies Curriculum;
