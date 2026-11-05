# Noria Drone Lab

An interactive browser tool for drone configuration, 3D inspection, simplified feasibility checks and STL component export.

## Status

Portfolio source snapshot prepared on 5 November 2026. Active development; feature descriptions are based on the retrieved source, not a claim of external production validation.

## What it does

- Configure dimensions, motors, battery, payload and materials.
- Inspect a Three.js model alongside the configuration.
- Convert a written brief through local parsing/rules when the user clicks configure.
- Assess thrust, power, energy, propeller clearance and mission constraints.
- Open the CAD workshop and export selected components as STL.

This snapshot uses local rules and calculations. It is not a cloud LLM service or a certified aircraft design tool. Feasibility checks are simplified estimates, not CFD, structural certification or proof that a real aircraft is safe to fly.

## Interface reasoning

The parameter panel and 3D view share one configuration so the user can connect a value with a physical component. Explicit configuration avoids unexpected edits while typing. Validation messages identify the parameter that blocks a mission instead of only showing a pass/fail animation.

## Run and inspect

Serve the source over HTTP (ES modules and workers should not be opened with file://):

```bash
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. No package installation is required for this snapshot. Modern browser with WebGL support required.

## Contribution and tooling

Mile Vujasin: product requirements, interface direction, iterative design decisions and implementation work using AI-assisted development. Third-party frameworks, libraries and bundled assets remain the work of their respective authors. This repository does not claim that every line was manually written or that user-research outcomes have been formally measured.

## Portfolio hygiene

No Git history, production database export, private workflow notes, authentication tokens or original hosting project identity are included. A separate environment is needed for backend operations. No open-source licence for the original application is granted by this snapshot; third-party notices are retained.
