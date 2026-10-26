"""The 200 virtual domains created on first boot.

Lengths follow the rarity contract exactly:
  common 8+ · rare 6–7 · epic 5 · legendary 3–4 · mythic 2
"""

COMMON = [
    "aurorahub", "neonwave", "pixelport", "lunarlab", "solarnet", "cybercore",
    "quantumnet", "orbitzone", "matrixlab", "vectorwave", "cloudspot", "datastream",
    "hyperlink", "siliconbay", "circuitlab", "novadrive", "glowmart", "sparknest",
    "cosmicweb", "shadowbyte", "echoflow", "prismsync", "fluxpoint", "atomspace",
    "binarybay", "graphite", "crystalnet", "photonlab", "stellarhub", "magnetcore",
    "astrolab", "vortexnet", "zenithweb", "radiantbay", "gravitylab", "spectrum",
    "velocity", "horizonhub", "eclipsewave", "fusioncore", "plasmaflow", "turboforge",
    "emberlight", "twilight", "midnight", "starlight", "moonbase", "galaxyhub",
    "cometrail", "meteorlab", "astralnet", "celestial", "meridian", "solstice",
    "obsidian", "onyxlabs", "quartznet", "topazwave", "sapphire", "rubyforge",
    "diamondlab", "platinum", "titanium", "cobaltnet", "nickelbay", "carboncore",
    "graphenex", "polymerlab", "neutrino", "protonlab", "electron", "ionosphere",
    "photonic", "laserhub", "radarlab", "sonarwave", "signalnet", "packetbay",
    "routerlab", "servercore", "kernelnet", "socketlab", "bufferzone", "cacheflow",
    "stackhub", "syntaxlab", "codeforge", "devstream", "deploylab", "dockerbay",
    "gitforge", "branchlab", "commitnet", "mergewave", "buildcore", "releasehub",
    "versionlab", "patchnode", "bugfixlab", "testbench", "agilecore", "sprintlab",
    "scrumnet", "producthub", "growthlab", "metricbay", "funnelnet", "retention",
    "viralloop", "launchpad", "startupcore", "founderlab", "pitchdeck", "runwayhub",
    "unicornlab", "venturenet", "angelbay", "seedround", "capitalhub", "equitylab",
]

RARE = [
    "vortex", "nebula", "pulsar", "quasar", "photon", "proton", "neutron", "hadron",
    "fusion", "fission", "plasma", "static", "signal", "sensor", "cipher", "cypher",
    "decode", "encode", "binary", "matrix", "vector", "scalar", "tensor", "lambda",
    "quantum", "circuit", "module", "kernel", "socket", "packet", "buffer", "cavern",
    "syntax", "script", "object", "method", "inline", "server", "client", "render",
    "layout", "anchor", "beacon", "bridge", "tunnel", "gateway", "router", "switch",
    "domain", "hosted",
]

EPIC = [
    "nexus", "prism", "pulse", "spark", "drift", "pixel", "sonic", "vapor", "crypt",
    "flair", "flare", "orbit", "astro", "solar", "lunar", "comet", "blaze", "ember",
    "frost", "storm",
]

LEGENDARY = ["apex", "nova", "flux", "zen", "arc", "ion", "volt"]

MYTHIC = ["ox", "ai", "go"]

ZONES = (".ru", ".com", ".io")

SEED_GROUPS = (
    ("common", COMMON),
    ("rare", RARE),
    ("epic", EPIC),
    ("legendary", LEGENDARY),
    ("mythic", MYTHIC),
)

ALL_NAMES = [name for _, names in SEED_GROUPS for name in names]
assert len(ALL_NAMES) == 200, f"expected 200 domains, got {len(ALL_NAMES)}"
assert len(ALL_NAMES) == len(set(ALL_NAMES)), "seed domains must be unique"
