# VChart site

This folder stores projects related to the VChart site, and also contains all Chinese and English documents, chart sample codes, etc. of the site.

## Directory description

### Document content

The contents of the document are stored in the `assets` folder.

```bash
assets
├── api             # VChart api interface document
│ ├── en            # English document directory
│ ├── menu.json     # Index configuration of VChart api interface document
│ └── zh            # Chinese document directory
├── demos           # VChart Some demos on the homepage of the website
│ ├── builtin-theme
│ ├── chart-history
│ ├── Qixi
│ └── template
├── examples        # VChart chart examples
│ ├── en            # VChart chart example English version
│ ├── menu.json     # Index configuration of VChart chart sample document
│ └── zh            # VChart chart example Chinese version
├── options         # VChart configuration item document
│ ├── en            # VChart configuration item document English version
│ └── zh            # VChart configuration item document Chinese text
├── themes          # VChart chart theme
│ ├── dark          # VChart chart dark theme
│ └── light         # VChart chart default theme
└── tutorials       # VChart tutorial document
     ├── en         # VChart tutorial document English version
     ├── menu.json  # Index configuration of VChart tutorial document
     └── zh         # VChart tutorial document Chinese version
```

### Project Code

The code of the project is located in the `src` folder

## How to start

```bash
# Global commands
$ rush docs

# You can also enter the docs folder and run
$ rushx start
```
