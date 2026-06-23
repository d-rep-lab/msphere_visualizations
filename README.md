# Carbon Source Utilization Visualizations

Interactive heatmap and Venn diagram visualizing carbon source utilization (OD readings over time) for *Streptococcus pneumoniae* strains.

## Data

Raw data is in `data/` (e.g., `data/total data.xlsx`). The scripts assume a two-sheet Excel workbook:

| Sheet | Contents |
|-------|----------|
| Sheet1 | Time-series OD readings. Row 0 = timepoints; column A = `<strain> <carbon>` labels. |
| Sheet2 | Lookup grid that defines strain and carbon-source ordering. Row 0 = carbon sources; column A = strains. |

Two scripts in `scripts/` generate the JSON data files consumed by the visualizations:

| Script | Output | Used by |
|--------|--------|---------|
| `generate_json.py` | `data/carbon_heatmap_data.json` | `index.html` (heatmap) |
| `generate_venn_data.py` | `data/venn_data.json` | `venn.html` (Venn diagram) |

To regenerate the JSON after updating the workbook:

```bash
pip install openpyxl
python scripts/generate_json.py
python scripts/generate_venn_data.py
```

`generate_json.py` prints a summary line (`N strains × M carbons = K cells`) and logs any rows it couldn't parse to stderr.

## Running locally

Both visualizations fetch their JSON data via `fetch()`, so opening the HTML files directly as `file://` URLs will be blocked by CORS. Serve the project with a local HTTP server instead:

```bash
python -m http.server 8000
```

Then open in your browser:

- [http://localhost:8000](http://localhost:8000) — Heatmap (`index.html`)
- [http://localhost:8000/venn.html](http://localhost:8000/venn.html) — Venn diagram

## Visualizations

Both are built with [D3.js](https://d3js.org).

### Heatmap (`index.html`)

- **Color scale** — Viridis, mapped to the global min/max peak OD across all strain/carbon combinations.
- **Cell labels** — Peak OD values are printed inside each cell when cells are large enough (≥ 18 px).
- **Tooltip** — Hovering over a cell shows the full OD growth curve for that strain/carbon combination, including the peak timepoint.

### Venn Diagram (`venn.html`)

- **Strain selection** — Compare 2–3 strains at a time; strains can be swapped via the sidebar.
- **OD threshold slider** — A substrate is counted as "active" for a strain if its peak OD within the selected time window meets or exceeds the threshold.
- **Time window slider** — Restricts the OD time series to a maximum timepoint, letting you explore utilization at different growth stages.
- **Region click** — Clicking a Venn region lists all substrates exclusive to that intersection in a side panel.
