"""
Ratan Bandhu Fabrics — public home page.

Phase 1 is front-end only. This controller stays deliberately empty:
no DocTypes, no queries, no API calls. All product and catalog content
is demo data living in index.js until the backend phase.
"""

no_cache = 1


def get_context(context):
    context.no_cache = 1
    context.title = "Ratan Bandhu Fabrics — Woven & spun fabrics from Surat"
    return context