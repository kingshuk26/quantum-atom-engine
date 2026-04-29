# ⚛️ Quantum Atom Simulation Engine

A browser-based quantum simulation engine that numerically solves the **radial Kohn–Sham equations** using **Self-Consistent Field (SCF)** methods and visualizes electron density in real time.

---

## 🚀 Overview

This project implements a simplified **Density Functional Theory (DFT)** solver for atoms, enabling users to explore how electron density forms around a nucleus.

Unlike traditional quantum chemistry tools, this runs entirely in the browser with an interactive UI.

---

## 🧠 Core Concepts

* Self-Consistent Field (SCF) iteration
* Radial Kohn–Sham equations
* Local Density Approximation (LDA)
* Electron density: ρ(r) = |ψ(r)|²
* Hartree and Exchange-Correlation potentials

---

## 🧩 Features

* 🔬 Real-time SCF simulation
* 📊 Convergence tracking (energy iteration graph)
* 🌌 3D electron density visualization
* ⚙️ Adjustable parameters (Z, charge, mixing, iterations)
* 🧪 Orbital-level insights (1s, 2p, etc.)

---

## ⚠️ Current Status

> 🚧 **Convergence stability is under active development**

* SCF may not converge for all configurations
* Numerical stability improvements (mixing, damping, normalization) are in progress
* Energy values are currently qualitative (not fully physically accurate)

---

## 🛠️ Tech Stack

* React + TypeScript (frontend)
* Vite (build system)
* Custom numerical solver (no external quantum libraries)
* WebGL-based 3D visualization

---

## 🧪 Example Use Cases

* Visualizing hydrogen-like atoms
* Exploring effect of nuclear charge (Z)
* Studying electron density changes with ionic charge
* Understanding SCF convergence behavior

---

## 📊 Limitations

* Simplified radial model (no full 3D orbital anisotropy)
* LDA approximation only
* Not suitable for precise scientific calculations
* Browser-based computation limits performance

---

## 🧠 Why This Project Matters

This project bridges the gap between:

> ❌ Black-box quantum chemistry tools
> ✅ Interactive learning and visualization

It helps users **see how quantum systems converge (or fail to)** rather than just compute results.

---

## 🚀 Future Improvements

* Stable SCF convergence (Anderson / DIIS mixing)
* GPU acceleration (WebGL / WASM)
* Full orbital visualization (p, d shapes)
* Backend compute support (Python / PySCF integration)
* Molecular systems (multi-atom support)

---

## 📌 Installation

```bash
git clone https://github.com/kingshuk26/quantum-atom-engine
cd quantum-atom-engine
npm install
npm run dev
```

---

## 🌐 Live Demo

https://your-vercel-link.vercel.app

---

## 🤝 Contributing

Contributions are welcome — especially in:

* Numerical stability improvements
* Visualization enhancements
* Performance optimization

---

## 📄 License

MIT License

---

## 💡 Inspiration

Inspired by quantum chemistry solvers and the need for **interactive physics tools** accessible in the browser.

---

## 🧑‍💻 Author

Kingshuk
Computer Science Undergraduate
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/30e1d65e-3cac-433b-b2e4-eb311d169900" />
