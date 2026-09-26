import frappe
from frappe import _
from frappe.utils import add_days, getdate, today


# ============================================================
# CONSTANTS / SMALL HELPERS
# ============================================================

DUMMY_BILL = "Saree Dummy Bill"

# Customer-facing stages (workflow state -> stage index)
CUSTOMER_STAGES = [
    "Enquiry Received",
    "Under Review",
    "Supplier Confirmation",
    "Commercial Confirmation",
    "Order Approved",
    "Processing",
    "Completed",
]

WORKFLOW_TO_STAGE_INDEX = {
    "Draft": 0,
    "Ratan Bandhu Review": 1,
    "Supplier Review": 1,
    "Supplier Confirmation": 2,
    "Commercial Confirmation": 3,
    "Approved": 4,
    "Processing": 5,
    "Completed": 6,
}


def _has_field(doctype, fieldname):
    try:
        return bool(frappe.get_meta(doctype).has_field(fieldname))
    except Exception:
        return False


def _dummy_bill_fields():
    fields = [
        "name",
        "customer",
        "supplier",
        "saree_design",
        "rate",
        "quantity",
        "amount",
        "status",
        "sales_order",
        "sales_invoice",
        "purchase_order",
        "purchase_invoice",
    ]

    if _has_field(DUMMY_BILL, "workflow_state"):
        fields.append("workflow_state")

    return fields


def _effective_state(row):
    """Workflow state of a Saree Dummy Bill (status can be stale)."""
    if not row:
        return ""

    return (
        row.get("workflow_state")
        or row.get("status")
        or ""
    )


def _get_default_company():
    company = frappe.defaults.get_user_default("Company")

    if not company:
        company = frappe.db.get_single_value(
            "Global Defaults",
            "default_company"
        )

    if not company:
        company = frappe.db.get_value(
            "Company",
            {"is_group": 0},
            "name"
        )

    if not company:
        frappe.throw(_("No Company is configured."))

    return company


def _parse_bill_names(dummy_bills):
    """Accept a JSON string / list of names / list of dicts with `name`."""
    if isinstance(dummy_bills, str):
        dummy_bills = frappe.parse_json(dummy_bills)

    if isinstance(dummy_bills, str):
        dummy_bills = [dummy_bills]

    if not isinstance(dummy_bills, (list, tuple)) or not dummy_bills:
        frappe.throw(_("Please select at least one Saree Dummy Bill."))

    names = []
    seen = set()

    for entry in dummy_bills:
        if isinstance(entry, dict):
            entry = entry.get("name")

        entry = (entry or "").strip() if isinstance(entry, str) else ""

        if not entry:
            frappe.throw(_("Invalid Saree Dummy Bill selection."))

        if entry not in seen:
            seen.add(entry)
            names.append(entry)

    return names


def _load_and_lock_bills(names):
    """Load the selected bills with a row lock. Missing ones are reported."""
    bills = []
    missing = []

    for name in names:
        row = frappe.db.get_value(
            DUMMY_BILL,
            name,
            _dummy_bill_fields(),
            as_dict=True,
            for_update=True
        )

        if not row:
            missing.append(name)
        else:
            bills.append(row)

    if missing:
        frappe.throw(
            _("Saree Dummy Bill not found: {0}").format(
                ", ".join(missing)
            )
        )

    return bills


def _get_item_info(item_names):
    info = {}

    if not item_names:
        return info

    rows = frappe.get_all(
        "Item",
        filters={"name": ["in", list(item_names)]},
        fields=["name", "item_name", "disabled"]
    )

    for row in rows:
        info[row.name] = row

    return info


def _get_sales_order_supplier_field():
    """Return a custom supplier field on Sales Order only if one exists."""
    for fieldname in ("supplier", "custom_supplier"):
        if not _has_field("Sales Order", fieldname):
            continue

        df = frappe.get_meta("Sales Order").get_field(fieldname)

        if df and (
            (df.fieldtype == "Link" and df.options == "Supplier")
            or df.fieldtype in ("Data", "Small Text")
        ):
            return fieldname

    return None


def _error_response(message):
    frappe.clear_messages()

    return {
        "success": False,
        "message": message
    }


def _server_error_response(log_title):
    frappe.db.rollback()

    frappe.log_error(
        frappe.get_traceback(),
        log_title
    )

    frappe.local.response.http_status_code = 500

    return {
        "success": False,
        "message": _(
            "Unable to complete the request right now. "
            "Please try again or contact the administrator."
        )
    }


# ============================================================
# GET PUBLISHED WEBSITE ITEMS
# ============================================================

@frappe.whitelist(allow_guest=True)
def get_published_items():

    items = frappe.get_all(
        "Item",
        filters={
            "disabled": 0,
            "publish_on_website": 1
        },
        fields=[
            "name",
            "item_code",
            "item_name",
            "item_group",
            "custom_item_description",
            "image",
            "rate",
            "custom_from_supplier",
            "stock_uom",
        ],
        order_by="item_name asc"
    )

    result = []

    for item in items:

        images = frappe.get_all(
            "Item Website Image",
            filters={
                "parent": item.name,
                "parenttype": "Item"
            },
            fields=[
                "image"
            ],
            order_by="idx asc"
        )

        image_list = []

        for row in images:

            if row.image:
                image_list.append(row.image)

        if item.image and item.image not in image_list:

            image_list.insert(
                0,
                item.image
            )

        result.append({

            "id": item.item_code or item.name,

            "name": item.item_name or "",

            "catalog": item.item_group or "",

            "category": item.item_group or "",

            "supplier": item.custom_from_supplier or "",

            "rate": item.rate or 0,

            "desc": item.custom_item_description or "",

            "stock_uom": item.stock_uom or "",

            "image": (
                image_list[0]
                if image_list
                else ""
            ),

            "images": image_list,

        })

    return result


# ============================================================
# CSRF TOKEN FOR THE PUBLIC ENQUIRY PAGE
# ============================================================

@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_website_csrf_token():

    token = ""

    session = getattr(
        frappe.local,
        "session",
        None
    )

    if session and getattr(session, "data", None):

        token = session.data.get("csrf_token") or ""

    return {
        "csrf_token": token
    }


# ============================================================
# FIND CUSTOMER
# ============================================================

@frappe.whitelist(allow_guest=True)
def lookup_customer(
    contact_no=None,
    gstin=None
):

    contact_no = (
        contact_no or ""
    ).strip()

    gstin = (
        gstin or ""
    ).strip().upper()

    customer_by_gstin = None
    customer_by_phone = None

    if gstin:

        customer_by_gstin = frappe.db.get_value(
            "Customer",
            {
                "gstin": gstin
            },
            "name"
        )

    if contact_no:

        contacts = frappe.get_all(
            "Contact",
            filters={
                "phone": contact_no
            },
            fields=[
                "name"
            ],
            limit=20
        )

        for contact in contacts:

            links = frappe.get_all(
                "Dynamic Link",
                filters={
                    "parent": contact.name,
                    "parenttype": "Contact",
                    "link_doctype": "Customer"
                },
                fields=[
                    "link_name"
                ],
                limit=10
            )

            if links:

                customer_by_phone = (
                    links[0].link_name
                )

                break

    if (
        customer_by_gstin
        and customer_by_phone
        and customer_by_gstin != customer_by_phone
    ):

        return {

            "success": False,

            "message":
                "Contact Number and GSTIN belong to different customers."

        }

    customer = (
        customer_by_gstin
        or customer_by_phone
    )

    if not customer:

        return {

            "success": False,

            "message":
                "Customer not found. Please check the Contact Number or GSTIN."

        }

    return {

        "success": True,

        "customer": customer

    }


# ============================================================
# CREATE SAREE DUMMY BILLS
# ============================================================

@frappe.whitelist(allow_guest=True, methods=["POST"])
def create_saree_dummy_bills(
    customer,
    items
):

    try:

        customer = (
            customer or ""
        ).strip()

        if not customer:

            frappe.throw(
                _("Customer is required.")
            )

        if not frappe.db.exists(
            "Customer",
            customer
        ):

            frappe.throw(
                _("Customer does not exist.")
            )

        if not items:

            frappe.throw(
                _("At least one product is required.")
            )

        if isinstance(
            items,
            str
        ):

            items = frappe.parse_json(
                items
            )

        if not isinstance(
            items,
            list
        ):

            frappe.throw(
                _("Invalid items data.")
            )

        created_bills = []

        for row in items:

            if not isinstance(
                row,
                dict
            ):

                frappe.throw(
                    _("Invalid product data.")
                )

            item_code = (
                row.get("item_code")
                or ""
            ).strip()

            if not item_code:

                frappe.throw(
                    _("Item Code is required.")
                )

            try:

                quantity = float(
                    row.get("quantity") or 0
                )

            except (
                TypeError,
                ValueError
            ):

                quantity = 0

            if quantity <= 0:

                frappe.throw(
                    _("Quantity must be greater than zero for {0}.").format(item_code)
                )

            item = frappe.db.get_value(
                "Item",
                {
                    "item_code": item_code
                },
                [
                    "name",
                    "item_code",
                    "item_name",
                    "rate",
                    "custom_from_supplier",
                    "publish_on_website"
                ],
                as_dict=True
            )

            if not item:

                item = frappe.db.get_value(
                    "Item",
                    item_code,
                    [
                        "name",
                        "item_code",
                        "item_name",
                        "rate",
                        "custom_from_supplier",
                        "publish_on_website"
                    ],
                    as_dict=True
                )

            if not item:

                frappe.throw(
                    _("Item {0} was not found.").format(item_code)
                )

            if not item.publish_on_website:

                frappe.throw(
                    _("{0} is not published on the website.").format(item.item_name)
                )

            rate = float(
                item.rate or 0
            )

            amount = (
                rate * quantity
            )

            supplier = (
                item.custom_from_supplier
                or ""
            )

            dummy_bill = frappe.get_doc({

                "doctype":
                    DUMMY_BILL,

                "customer":
                    customer,

                "supplier":
                    supplier,

                "saree_design":
                    item.name,

                "rate":
                    rate,

                "quantity":
                    quantity,

                "amount":
                    amount,

                "status":
                    "Draft"

            })

            dummy_bill.insert(
                ignore_permissions=True
            )

            created_bills.append({

                "name":
                    dummy_bill.name,

                "item":
                    item.item_name,

                "item_code":
                    item.item_code,

                "supplier":
                    supplier,

                "rate":
                    rate,

                "quantity":
                    quantity,

                "amount":
                    amount,

                "status":
                    "Draft"

            })

        frappe.db.commit()

        return {

            "success":
                True,

            "count":
                len(created_bills),

            "bills":
                created_bills

        }

    except frappe.ValidationError:

        raise

    except Exception:

        frappe.db.rollback()

        frappe.log_error(
            frappe.get_traceback(),
            "create_saree_dummy_bills failed"
        )

        frappe.local.response.http_status_code = 500

        return {

            "success":
                False,

            "message":
                _(
                    "Something went wrong while submitting your enquiry. "
                    "Please try again or contact us directly."
                )

        }


# ============================================================
# TRACK ORDER
# ============================================================
#
# Public "Track Your Order" flow:
#
#   Enter Dummy Bill ID + Contact Number OR GSTIN
#         -> Verify the bill belongs to a Customer whose
#            Contact/GSTIN matches what was entered
#         -> Return every Saree Dummy Bill for that Customer
#            (not just the one bill they typed), so the visitor
#            can see their full order history
#         -> Optional from_date / to_date / status filters are
#            applied server-side against that same Customer's
#            orders
#
# Nothing here reveals data for a customer the visitor cannot
# already prove ownership of: the Bill ID alone is not enough,
# it must also match the Contact Number or GSTIN tied to the
# Customer on that bill.
#
# Internal document numbers (Sales Order, Invoice, Purchase
# Order, ...) are NEVER returned. Only milestone indicators.
# ============================================================

def _build_customer_progress(state):
    """Customer-facing stage list for a workflow state."""
    if state == "Cancelled":
        return {
            "stage_label": "Cancelled",
            "progress": [],
            "cancelled": True
        }

    index = WORKFLOW_TO_STAGE_INDEX.get(state, 0)

    progress = []

    for i, label in enumerate(CUSTOMER_STAGES):
        progress.append({
            "label": label,
            "done": i < index or (i == index and state == "Completed"),
            "current": i == index and state != "Completed"
        })

    return {
        "stage_label": CUSTOMER_STAGES[index],
        "progress": progress,
        "cancelled": False
    }


def _build_milestones(row):
    milestones = {
        "sales_order_created": bool(row.get("sales_order")),
        "sales_invoice_created": bool(row.get("sales_invoice")),
        "purchase_order_created": bool(row.get("purchase_order")),
        "purchase_invoice_created": bool(row.get("purchase_invoice")),
    }

    milestone_list = [
        {
            "label": "Sales Order Created",
            "done": milestones["sales_order_created"]
        },
        {
            "label": "Sales Invoice Created",
            "done": milestones["sales_invoice_created"]
        },
        {
            "label": "Purchase Order Created",
            "done": milestones["purchase_order_created"]
        },
        {
            "label": "Purchase Invoice Created",
            "done": milestones["purchase_invoice_created"]
        },
    ]

    return milestones, milestone_list


@frappe.whitelist(allow_guest=True)
def track_customer_orders(
    bill_id=None,
    contact_no=None,
    gstin=None,
    from_date=None,
    to_date=None,
    status=None
):

    bill_id = (
        bill_id or ""
    ).strip()

    contact_no = (
        contact_no or ""
    ).strip()

    gstin = (
        gstin or ""
    ).strip().upper()

    status = (
        status or ""
    ).strip()

    # --------------------------------------------------------
    # VALIDATE INPUT
    # --------------------------------------------------------

    if not bill_id:

        return {

            "success": False,

            "message":
                _("Please enter your Order / Bill ID.")

        }

    if not contact_no and not gstin:

        return {

            "success": False,

            "message":
                _("Please enter your Contact Number or GSTIN to verify the order.")

        }

    # --------------------------------------------------------
    # LOOK UP THE BILL THEY TYPED
    # --------------------------------------------------------

    bill = frappe.db.get_value(
        DUMMY_BILL,
        bill_id,
        [
            "name",
            "customer"
        ],
        as_dict=True
    )

    if not bill or not bill.customer:

        return {

            "success": False,

            "message":
                _("We couldn't find an order with that ID. Please check and try again.")

        }

    customer = bill.customer

    # --------------------------------------------------------
    # VERIFY OWNERSHIP
    #
    # The Contact Number or GSTIN supplied must belong to the
    # SAME Customer as the bill, otherwise nothing is returned.
    # --------------------------------------------------------

    verified = False

    if gstin:

        customer_gstin = frappe.db.get_value(
            "Customer",
            customer,
            "gstin"
        )

        if (
            customer_gstin
            and customer_gstin.strip().upper() == gstin
        ):

            verified = True

    if not verified and contact_no:

        contacts = frappe.get_all(
            "Contact",
            filters={
                "phone": contact_no
            },
            fields=[
                "name"
            ],
            limit=20
        )

        for contact in contacts:

            match = frappe.get_all(
                "Dynamic Link",
                filters={
                    "parent": contact.name,
                    "parenttype": "Contact",
                    "link_doctype": "Customer",
                    "link_name": customer
                },
                fields=[
                    "link_name"
                ],
                limit=1
            )

            if match:

                verified = True

                break

    if not verified:

        return {

            "success": False,

            "message":
                _("The Contact Number or GSTIN you entered doesn't match this order. Please check and try again.")

        }

    # --------------------------------------------------------
    # FETCH ALL ORDERS FOR THIS CUSTOMER, WITH OPTIONAL FILTERS
    # --------------------------------------------------------

    order_filters = [
        [DUMMY_BILL, "customer", "=", customer]
    ]

    try:

        if from_date:

            order_filters.append([
                DUMMY_BILL,
                "creation",
                ">=",
                str(getdate(from_date))
            ])

        if to_date:

            order_filters.append([
                DUMMY_BILL,
                "creation",
                "<",
                str(add_days(getdate(to_date), 1))
            ])

    except Exception:

        return {

            "success": False,

            "message":
                _("Please enter valid dates.")

        }

    orders = frappe.get_all(
        DUMMY_BILL,
        filters=order_filters,
        fields=_dummy_bill_fields() + ["creation"],
        order_by="creation desc",
        limit=500
    )

    status_filter = status.lower()

    result = []

    for order in orders:

        state = _effective_state(order)

        progress_info = _build_customer_progress(state)

        if status_filter and status_filter not in (
            state.lower(),
            (order.status or "").lower(),
            progress_info["stage_label"].lower()
        ):
            continue

        item_name = frappe.db.get_value(
            "Item",
            order.saree_design,
            "item_name"
        ) or order.saree_design

        milestones, milestone_list = _build_milestones(order)

        result.append({

            "name": order.name,

            "item_code": order.saree_design,

            "item_name": item_name,

            "supplier": order.supplier or "",

            "rate": order.rate or 0,

            "quantity": order.quantity or 0,

            "amount": order.amount or 0,

            "status": state,

            "workflow_state": state,

            "stage_label": progress_info["stage_label"],

            "progress": progress_info["progress"],

            "cancelled": progress_info["cancelled"],

            "milestones": milestones,

            "milestone_list": milestone_list,

            "date":
                order.creation.strftime("%Y-%m-%d")
                if order.creation
                else ""

        })

        if len(result) >= 200:
            break

    customer_name = frappe.db.get_value(
        "Customer",
        customer,
        "customer_name"
    ) or customer

    return {

        "success": True,

        "customer": customer,

        "customer_name": customer_name,

        "orders": result

    }


# ============================================================
# SALES ORDER -> "GET ITEMS FROM" -> SAREE DUMMY BILL
# ============================================================
#
# 1. get_eligible_dummy_bills_for_sales_order
#      Lists the Approved Dummy Bills that can still be used
#      (for the "Get Items From -> Saree Dummy Bill" dialog).
#      This is READ-ONLY: it never creates or saves anything.
#
# 2. link_dummy_bills_to_sales_order
#      NEW STRAIGHT-FLOW API. Called AFTER the user has manually
#      saved the current Sales Order in the normal ERPNext form.
#      It only links the selected, already-Approved Dummy Bills
#      to that already-existing Sales Order. It NEVER creates a
#      Sales Order.
#
# 3. make_sales_orders_from_dummy_bills
#      OLDER backend used by the postponed "reverse" flow (see
#      create_sales_order_from_current_dummy_bill below). It
#      groups Dummy Bills by (customer, supplier) and creates a
#      new Sales Order per group. Left completely untouched.
#      The new "Add Selected Items" straight-flow dialog must
#      NOT call this function.
# ============================================================

@frappe.whitelist()
def get_eligible_dummy_bills_for_sales_order(
    customer=None,
    supplier=None,
    txt=None,
    limit=50
):

    frappe.has_permission(
        DUMMY_BILL,
        "read",
        throw=True
    )

    try:
        limit = max(1, min(int(limit or 50), 200))
    except (TypeError, ValueError):
        limit = 50

    filters = [
        ["customer", "is", "set"],
        ["supplier", "is", "set"],
        ["saree_design", "is", "set"],
        ["quantity", ">", 0],
        ["sales_order", "is", "not set"],
    ]

    if customer:
        filters.append(["customer", "=", customer])

    if supplier:
        filters.append(["supplier", "=", supplier])

    or_filters = None

    txt = (txt or "").strip()

    if txt:
        or_filters = [
            ["name", "like", "%{0}%".format(txt)],
            ["saree_design", "like", "%{0}%".format(txt)],
            ["customer", "like", "%{0}%".format(txt)],
        ]

    rows = frappe.get_list(
        DUMMY_BILL,
        filters=filters,
        or_filters=or_filters,
        fields=_dummy_bill_fields() + ["creation"],
        order_by="creation asc",
        limit_page_length=500
    )

    eligible = [
        row for row in rows
        if _effective_state(row) == "Approved"
    ]

    # --- server-side validity checks (not just "is set") -------------
    customers_seen = {row.customer for row in eligible if row.customer}
    suppliers_seen = {row.supplier for row in eligible if row.supplier}

    existing_customers = set(
        frappe.get_all(
            "Customer",
            filters={"name": ["in", list(customers_seen)]},
            pluck="name"
        )
    ) if customers_seen else set()

    existing_suppliers = set(
        frappe.get_all(
            "Supplier",
            filters={"name": ["in", list(suppliers_seen)]},
            pluck="name"
        )
    ) if suppliers_seen else set()

    item_info = _get_item_info(
        {row.saree_design for row in eligible}
    )

    valid_rows = []

    for row in eligible:

        if row.customer not in existing_customers:
            continue

        if row.supplier not in existing_suppliers:
            continue

        info = item_info.get(row.saree_design)

        if not info or info.disabled:
            continue

        valid_rows.append(row)

    valid_rows = valid_rows[:limit]

    result = []

    for row in valid_rows:

        info = item_info.get(row.saree_design)

        result.append({
            "name": row.name,
            "customer": row.customer,
            "supplier": row.supplier,
            "saree_design": row.saree_design,
            "item_name": (
                info.item_name
                if info and info.item_name
                else row.saree_design
            ),
            "quantity": row.quantity or 0,
            "rate": row.rate or 0,
            "amount": row.amount or 0,
            "workflow_state": _effective_state(row),
        })

    return result


def _validate_bills_for_sales_order(bills):
    """Return a list of human-readable problems (empty if all valid)."""
    problems = []

    item_info = _get_item_info(
        {b.saree_design for b in bills if b.saree_design}
    )

    already_linked = {}

    for bill in bills:

        name = bill.name

        if _effective_state(bill) != "Approved":
            problems.append(
                _("{0}: must be in Approved state.").format(name)
            )

        if not bill.customer:
            problems.append(_("{0}: Customer is missing.").format(name))

        elif not frappe.db.exists("Customer", bill.customer):
            problems.append(
                _("{0}: Customer {1} does not exist.").format(name, bill.customer)
            )

        if not bill.supplier:
            problems.append(_("{0}: Supplier is missing.").format(name))

        elif not frappe.db.exists("Supplier", bill.supplier):
            problems.append(
                _("{0}: Supplier {1} does not exist.").format(name, bill.supplier)
            )

        if not bill.saree_design:
            problems.append(_("{0}: Saree Design is missing.").format(name))

        else:
            info = item_info.get(bill.saree_design)

            if not info:
                problems.append(
                    _("{0}: Item {1} does not exist.").format(name, bill.saree_design)
                )

            elif info.disabled:
                problems.append(
                    _("{0}: Item {1} is disabled.").format(name, bill.saree_design)
                )

        if not bill.quantity or bill.quantity <= 0:
            problems.append(
                _("{0}: Quantity must be greater than zero.").format(name)
            )

        if bill.rate is not None and bill.rate < 0:
            problems.append(
                _("{0}: Rate cannot be negative.").format(name)
            )

        if bill.sales_order:
            already_linked[name] = bill.sales_order
            problems.append(
                _("{0}: already linked to a Sales Order.").format(name)
            )

        if not frappe.has_permission(DUMMY_BILL, "write", doc=name):
            problems.append(
                _("{0}: you do not have permission to update this record.").format(name)
            )

    return problems, already_linked


# ------------------------------------------------------------
# NEW: validation + API for the STRAIGHT FLOW.
#
# This does NOT create a Sales Order. It links Dummy Bills to
# a Sales Order that the user has already saved themselves.
# ------------------------------------------------------------

def _validate_bills_for_linking(bills, sales_order_doc, supplier_field, existing_supplier):
    """Validate bills for linking to an ALREADY EXISTING Sales Order.

    Unlike _validate_bills_for_sales_order, this checks the bill's
    customer/supplier against the target Sales Order rather than just
    checking internal consistency, and never creates anything.
    """
    problems = []

    item_info = _get_item_info(
        {b.saree_design for b in bills if b.saree_design}
    )

    suppliers_seen = set()

    for bill in bills:

        name = bill.name

        if _effective_state(bill) != "Approved":
            problems.append(
                _("{0}: must be in Approved state.").format(name)
            )

        if not bill.customer:
            problems.append(_("{0}: Customer is missing.").format(name))

        elif bill.customer != sales_order_doc.customer:
            problems.append(
                _(
                    "Dummy Bill {0} belongs to customer {1} and cannot be "
                    "linked to Sales Order {2} for customer {3}."
                ).format(
                    name,
                    bill.customer,
                    sales_order_doc.name,
                    sales_order_doc.customer
                )
            )

        if not bill.supplier:
            problems.append(_("{0}: Supplier is missing.").format(name))

        else:
            suppliers_seen.add(bill.supplier)

            if existing_supplier and bill.supplier != existing_supplier:
                problems.append(
                    _(
                        "{0}: Supplier {1} does not match Sales Order "
                        "{2}'s supplier {3}."
                    ).format(
                        name, bill.supplier, sales_order_doc.name, existing_supplier
                    )
                )

        if not bill.saree_design:
            problems.append(_("{0}: Saree Design is missing.").format(name))

        else:
            info = item_info.get(bill.saree_design)

            if not info:
                problems.append(
                    _("{0}: Item {1} does not exist.").format(name, bill.saree_design)
                )

            elif info.disabled:
                problems.append(
                    _("{0}: Item {1} is disabled.").format(name, bill.saree_design)
                )

        if not bill.quantity or bill.quantity <= 0:
            problems.append(
                _("{0}: Quantity must be greater than zero.").format(name)
            )

        if bill.rate is not None and bill.rate < 0:
            problems.append(
                _("{0}: Rate cannot be negative.").format(name)
            )

        if bill.sales_order:
            problems.append(
                _("{0}: already linked to Sales Order {1}.").format(
                    name, bill.sales_order
                )
            )

        if not frappe.has_permission(DUMMY_BILL, "write", doc=name):
            problems.append(
                _("{0}: you do not have permission to update this record.").format(name)
            )

    if not existing_supplier and len(suppliers_seen) > 1:
        problems.append(
            _(
                "Selected Saree Dummy Bills belong to different suppliers "
                "({0}). They must all share the same supplier to be linked "
                "to one Sales Order."
            ).format(", ".join(sorted(suppliers_seen)))
        )

    return problems, suppliers_seen


@frappe.whitelist(methods=["POST"])
def link_dummy_bills_to_sales_order(sales_order, dummy_bills):
    """Link already-Approved Dummy Bills to an EXISTING, already-saved
    Sales Order. This function NEVER creates or inserts a Sales Order -
    it only sets `sales_order` on the selected Dummy Bills.

    Used by the "Add Selected Items" dialog, called AFTER the user has
    manually saved their Sales Order in the standard ERPNext form.
    """

    try:

        sales_order = (sales_order or "").strip()

        if not sales_order:
            frappe.throw(_("Sales Order is required."))

        if not frappe.db.exists("Sales Order", sales_order):
            frappe.throw(
                _("Sales Order {0} does not exist.").format(sales_order)
            )

        if not frappe.has_permission("Sales Order", "read", doc=sales_order):
            frappe.throw(
                _("You do not have permission to read Sales Order {0}.").format(
                    sales_order
                ),
                frappe.PermissionError
            )

        frappe.has_permission(DUMMY_BILL, "read", throw=True)

        names = _parse_bill_names(dummy_bills)

        # Load + row-lock every selected Dummy Bill up front, exactly
        # like the existing create-flow does, so nothing can change
        # under us between validation and the writes below.
        bills = _load_and_lock_bills(names)

        so = frappe.db.get_value(
            "Sales Order",
            sales_order,
            ["name", "customer"],
            as_dict=True
        )

        if not so.customer:
            frappe.throw(
                _(
                    "Sales Order {0} must have a Customer before Dummy "
                    "Bills can be linked."
                ).format(sales_order)
            )

        supplier_field = _get_sales_order_supplier_field()

        existing_supplier = None

        if supplier_field:
            existing_supplier = frappe.db.get_value(
                "Sales Order",
                sales_order,
                supplier_field
            )

            existing_supplier = (existing_supplier or "").strip() or None

        problems, suppliers_seen = _validate_bills_for_linking(
            bills,
            so,
            supplier_field,
            existing_supplier
        )

        if problems:
            frappe.clear_messages()
            frappe.db.rollback()

            return {
                "success": False,
                "message": _(
                    "Dummy Bills were not linked because some selected "
                    "records are not valid."
                ),
                "errors": problems
            }

        if not frappe.has_permission("Sales Order", "write", doc=sales_order):
            frappe.clear_messages()
            frappe.db.rollback()

            return _error_response(
                _(
                    "You do not have permission to update Sales Order {0}."
                ).format(sales_order)
            )

        final_supplier = existing_supplier or (
            next(iter(suppliers_seen)) if suppliers_seen else None
        )

        # Only ever WRITE the supplier field if the Sales Order didn't
        # already have one. If it already had one, every bill was already
        # validated above to match it exactly - we never overwrite it.
        if supplier_field and not existing_supplier and final_supplier:
            frappe.db.set_value(
                "Sales Order",
                sales_order,
                supplier_field,
                final_supplier
            )

        # --------------------------------------------------------
        # ONLY step that touches Dummy Bills: link sales_order.
        # No workflow_state change, no status change (stays "Draft"
        # as it is workflow-managed separately), no Sales Order
        # insert/submit of any kind.
        # --------------------------------------------------------
        for bill in bills:
            frappe.db.set_value(
                DUMMY_BILL,
                bill.name,
                "sales_order",
                sales_order
            )

        frappe.db.commit()

        return {
            "success": True,
            "sales_order": sales_order,
            "customer": so.customer,
            "supplier": final_supplier,
            "count": len(bills),
            "dummy_bills": [b.name for b in bills]
        }

    except (frappe.ValidationError, frappe.PermissionError) as e:

        frappe.db.rollback()

        return _error_response(str(e))

    except Exception:

        return _server_error_response(
            "link_dummy_bills_to_sales_order failed"
        )


@frappe.whitelist(methods=["POST"])
def make_sales_orders_from_dummy_bills(
    dummy_bills,
    company=None
):

    try:

        frappe.has_permission(
            "Sales Order",
            "create",
            throw=True
        )

        names = _parse_bill_names(dummy_bills)

        # ----------------------------------------------------
        # 1. Load + lock + validate ALL selected bills first
        # ----------------------------------------------------
        bills = _load_and_lock_bills(names)

        problems, already_linked = _validate_bills_for_sales_order(bills)

        if problems:
            frappe.clear_messages()
            frappe.db.rollback()

            response = {
                "success": False,
                "message": _(
                    "Sales Orders were not created because some selected "
                    "Dummy Bills are not valid."
                ),
                "errors": problems
            }

            if already_linked:
                response["already_linked"] = [
                    {"dummy_bill": k, "sales_order": v}
                    for k, v in already_linked.items()
                ]

            return response

        # ----------------------------------------------------
        # 2. Group by (customer, supplier)
        # ----------------------------------------------------
        groups = {}

        for bill in bills:
            groups.setdefault(
                (bill.customer, bill.supplier),
                []
            ).append(bill)

        company = (company or "").strip() or _get_default_company()

        if not frappe.db.exists("Company", company):
            frappe.throw(_("Company {0} does not exist.").format(company))

        supplier_field = _get_sales_order_supplier_field()

        current_date = today()

        # ----------------------------------------------------
        # 3. Create + insert Sales Orders (standard ERPNext doc)
        # ----------------------------------------------------
        created = []

        for (customer, supplier), group_bills in groups.items():

            sales_order = frappe.new_doc("Sales Order")

            sales_order.customer = customer
            sales_order.company = company
            sales_order.transaction_date = current_date
            sales_order.delivery_date = current_date

            if supplier_field:
                sales_order.set(supplier_field, supplier)

            for bill in group_bills:
                sales_order.append(
                    "items",
                    {
                        "item_code": bill.saree_design,
                        "qty": bill.quantity,
                        "rate": bill.rate or 0,
                        "delivery_date": current_date
                    }
                )

            if hasattr(sales_order, "set_missing_values"):
                sales_order.set_missing_values()

            if hasattr(sales_order, "calculate_taxes_and_totals"):
                sales_order.calculate_taxes_and_totals()

            sales_order.insert()

            created.append({
                "sales_order": sales_order.name,
                "customer": customer,
                "supplier": supplier,
                "dummy_bills": [b.name for b in group_bills]
            })

        # ----------------------------------------------------
        # 4. Only now link the source Dummy Bills
        # ----------------------------------------------------
        for entry in created:
            for bill_name in entry["dummy_bills"]:
                frappe.db.set_value(
                    DUMMY_BILL,
                    bill_name,
                    "sales_order",
                    entry["sales_order"]
                )

        frappe.db.commit()

        return {
            "success": True,
            "count": len(created),
            "sales_orders": created
        }

    except (frappe.ValidationError, frappe.PermissionError) as e:

        frappe.db.rollback()

        return _error_response(str(e))

    except Exception:

        return _server_error_response(
            "make_sales_orders_from_dummy_bills failed"
        )


# ============================================================
# SAREE DUMMY BILL -> CREATE SALES ORDER (reverse workflow)
# ============================================================
#
# Entry point used by the "Create Sales Order" button on an
# individual, Approved Saree Dummy Bill that does not yet have
# a Sales Order.
#
# This does NOT duplicate the Sales Order creation logic. It:
#
#   1. Validates the current Dummy Bill (Approved, no Sales
#      Order yet, has a Customer + Supplier).
#   2. Finds every other Approved, not-yet-linked Dummy Bill
#      that shares the SAME Customer and SAME Supplier.
#   3. Adds the current Dummy Bill to that set.
#   4. Hands the whole set to the existing, already-tested
#      make_sales_orders_from_dummy_bills(), which groups by
#      (customer, supplier) and creates ONE Sales Order.
#
# Because every bill in the set shares the same customer and
# supplier, make_sales_orders_from_dummy_bills() will always
# produce exactly one Sales Order group here.
# ============================================================

@frappe.whitelist(methods=["POST"])
def create_sales_order_from_current_dummy_bill(
    dummy_bill,
    company=None
):

    try:

        names = _parse_bill_names(dummy_bill)

        if len(names) != 1:
            frappe.throw(
                _("Please provide a single Saree Dummy Bill.")
            )

        current_name = names[0]

        if not frappe.has_permission(
            DUMMY_BILL,
            "read",
            doc=current_name
        ):
            frappe.throw(
                _("You do not have permission to read this record."),
                frappe.PermissionError
            )

        # --------------------------------------------------
        # 1. Load + validate the current Dummy Bill
        # --------------------------------------------------
        current = frappe.db.get_value(
            DUMMY_BILL,
            current_name,
            _dummy_bill_fields(),
            as_dict=True,
            for_update=True
        )

        if not current:
            frappe.throw(
                _("Saree Dummy Bill {0} not found.").format(current_name)
            )

        if _effective_state(current) != "Approved":
            frappe.throw(
                _("This Saree Dummy Bill must be Approved before a "
                  "Sales Order can be created.")
            )

        if current.sales_order:
            frappe.throw(
                _("This Saree Dummy Bill is already linked to "
                  "Sales Order {0}.").format(current.sales_order)
            )

        if not current.customer:
            frappe.throw(
                _("Customer is missing on this Saree Dummy Bill.")
            )

        if not current.supplier:
            frappe.throw(
                _("Supplier is missing on this Saree Dummy Bill.")
            )

        # --------------------------------------------------
        # 2. Find every other eligible Dummy Bill with the
        #    SAME customer + SAME supplier.
        # --------------------------------------------------
        filters = [
            ["customer", "=", current.customer],
            ["supplier", "=", current.supplier],
            ["saree_design", "is", "set"],
            ["quantity", ">", 0],
            ["sales_order", "is", "not set"],
        ]

        rows = frappe.get_list(
            DUMMY_BILL,
            filters=filters,
            fields=_dummy_bill_fields(),
            order_by="creation asc",
            limit_page_length=500
        )

        eligible_names = {
            row.name for row in rows
            if _effective_state(row) == "Approved"
        }

        # --------------------------------------------------
        # 3. Always include the current Dummy Bill itself.
        # --------------------------------------------------
        eligible_names.add(current_name)

        # --------------------------------------------------
        # 4. Reuse the existing, already-tested backend to
        #    actually create the Sales Order.
        # --------------------------------------------------
        result = make_sales_orders_from_dummy_bills(
            list(eligible_names),
            company=company
        )

        if not result.get("success"):
            # Bubble up the same success/message/errors shape
            # the client script already knows how to render.
            return result

        sales_orders = result.get("sales_orders") or []

        if not sales_orders:
            return _error_response(
                _("No Sales Order was created. Please try again.")
            )

        # Only one (customer, supplier) group is possible here,
        # but pick the group containing the current bill just
        # to be safe.
        matching = None

        for entry in sales_orders:
            if current_name in (entry.get("dummy_bills") or []):
                matching = entry
                break

        if not matching:
            matching = sales_orders[0]

        return {
            "success": True,
            "sales_order": matching.get("sales_order"),
            "customer": matching.get("customer"),
            "supplier": matching.get("supplier"),
            "count": len(matching.get("dummy_bills") or []),
            "dummy_bills": matching.get("dummy_bills") or []
        }

    except (frappe.ValidationError, frappe.PermissionError) as e:

        frappe.db.rollback()

        return _error_response(str(e))

    except Exception:

        return _server_error_response(
            "create_sales_order_from_current_dummy_bill failed"
        )


# ============================================================
# DEPRECATED: one Dummy Bill -> one Sales Order
# ============================================================
#
# The old single-bill approach is intentionally disabled. The
# new flow is Sales Order -> Get Items From -> Saree Dummy Bill
# (see make_sales_orders_from_dummy_bills), or the reverse
# "Create Sales Order" button on an Approved Dummy Bill (see
# create_sales_order_from_current_dummy_bill above).
# ============================================================

@frappe.whitelist()
def create_sales_order_from_dummy_bill(dummy_bill=None):

    return {
        "success": False,
        "deprecated": True,
        "message": _(
            "This action has been retired. From a new Sales Order use "
            "'Get Items From > Saree Dummy Bill' and select one or more "
            "Approved Dummy Bills."
        )
    }


# ============================================================
# SALES ORDER -> SALES INVOICE (standard ERPNext mapping)
# ============================================================

@frappe.whitelist(methods=["POST"])
def create_sales_invoice_from_dummy_bill(dummy_bill):

    try:

        names = _parse_bill_names(dummy_bill)

        if len(names) != 1:
            frappe.throw(_("Please select a single Saree Dummy Bill."))

        bill = _load_and_lock_bills(names)[0]

        if not frappe.has_permission(DUMMY_BILL, "write", doc=bill.name):
            frappe.throw(
                _("You do not have permission to update this record."),
                frappe.PermissionError
            )

        frappe.has_permission("Sales Invoice", "create", throw=True)

        if bill.sales_invoice:
            return {
                "success": True,
                "already_exists": True,
                "sales_invoice": bill.sales_invoice
            }

        if not bill.sales_order:
            frappe.throw(
                _("A Sales Order must be created before the Sales Invoice.")
            )

        sales_order = frappe.db.get_value(
            "Sales Order",
            bill.sales_order,
            ["name", "docstatus"],
            as_dict=True
        )

        if not sales_order:
            frappe.throw(
                _("Sales Order {0} does not exist.").format(bill.sales_order)
            )

        if sales_order.docstatus != 1:
            frappe.throw(
                _("Sales Order {0} must be submitted before creating the Sales Invoice.").format(
                    sales_order.name
                )
            )

        # Reuse an invoice that already exists for this Sales Order
        existing = frappe.get_all(
            "Sales Invoice Item",
            filters={
                "sales_order": sales_order.name,
                "docstatus": ["<", 2]
            },
            pluck="parent",
            limit=1
        )

        if existing:
            invoice_name = existing[0]
            already_exists = True

        else:
            from erpnext.selling.doctype.sales_order.sales_order import (
                make_sales_invoice
            )

            invoice = make_sales_invoice(sales_order.name)
            invoice.insert()

            invoice_name = invoice.name
            already_exists = False

        # Link every Dummy Bill that belongs to this Sales Order
        linked_bills = frappe.get_all(
            DUMMY_BILL,
            filters={
                "sales_order": sales_order.name,
                "sales_invoice": ["is", "not set"]
            },
            pluck="name"
        )

        for bill_name in linked_bills:
            frappe.db.set_value(
                DUMMY_BILL,
                bill_name,
                "sales_invoice",
                invoice_name
            )

        frappe.db.commit()

        return {
            "success": True,
            "already_exists": already_exists,
            "sales_invoice": invoice_name,
            "dummy_bills": linked_bills
        }

    except (frappe.ValidationError, frappe.PermissionError) as e:

        frappe.db.rollback()

        return _error_response(str(e))

    except Exception:

        return _server_error_response(
            "create_sales_invoice_from_dummy_bill failed"
        )


# ============================================================
# SAREE DUMMY BILL -> PURCHASE ORDER
# ============================================================
#
# Grouped by Supplier. One standard ERPNext Purchase Order is
# created per supplier. Bills must be Approved or Processing
# and must not already have a Purchase Order.
# ============================================================

def _validate_bills_for_purchase_order(bills):
    problems = []

    item_info = _get_item_info(
        {b.saree_design for b in bills if b.saree_design}
    )

    for bill in bills:

        name = bill.name

        if _effective_state(bill) not in ("Approved", "Processing"):
            problems.append(
                _("{0}: must be Approved or Processing.").format(name)
            )

        if not bill.supplier:
            problems.append(_("{0}: Supplier is missing.").format(name))

        elif not frappe.db.exists("Supplier", bill.supplier):
            problems.append(
                _("{0}: Supplier {1} does not exist.").format(name, bill.supplier)
            )

        if not bill.saree_design:
            problems.append(_("{0}: Saree Design is missing.").format(name))

        else:
            info = item_info.get(bill.saree_design)

            if not info:
                problems.append(
                    _("{0}: Item {1} does not exist.").format(name, bill.saree_design)
                )

            elif info.disabled:
                problems.append(
                    _("{0}: Item {1} is disabled.").format(name, bill.saree_design)
                )

        if not bill.quantity or bill.quantity <= 0:
            problems.append(
                _("{0}: Quantity must be greater than zero.").format(name)
            )

        if bill.rate is not None and bill.rate < 0:
            problems.append(
                _("{0}: Rate cannot be negative.").format(name)
            )

        if bill.purchase_order:
            problems.append(
                _("{0}: already linked to a Purchase Order.").format(name)
            )

        if not frappe.has_permission(DUMMY_BILL, "write", doc=name):
            problems.append(
                _("{0}: you do not have permission to update this record.").format(name)
            )

    return problems


@frappe.whitelist(methods=["POST"])
def make_purchase_orders_from_dummy_bills(
    dummy_bills,
    company=None
):

    try:

        frappe.has_permission(
            "Purchase Order",
            "create",
            throw=True
        )

        names = _parse_bill_names(dummy_bills)

        bills = _load_and_lock_bills(names)

        problems = _validate_bills_for_purchase_order(bills)

        if problems:
            frappe.clear_messages()
            frappe.db.rollback()

            return {
                "success": False,
                "message": _(
                    "Purchase Orders were not created because some selected "
                    "Dummy Bills are not valid."
                ),
                "errors": problems
            }

        groups = {}

        for bill in bills:
            groups.setdefault(bill.supplier, []).append(bill)

        company = (company or "").strip() or _get_default_company()

        if not frappe.db.exists("Company", company):
            frappe.throw(_("Company {0} does not exist.").format(company))

        current_date = today()

        created = []

        for supplier, group_bills in groups.items():

            purchase_order = frappe.new_doc("Purchase Order")

            purchase_order.supplier = supplier
            purchase_order.company = company
            purchase_order.transaction_date = current_date
            purchase_order.schedule_date = current_date

            for bill in group_bills:
                purchase_order.append(
                    "items",
                    {
                        "item_code": bill.saree_design,
                        "qty": bill.quantity,
                        "rate": bill.rate or 0,
                        "schedule_date": current_date
                    }
                )

            if hasattr(purchase_order, "set_missing_values"):
                purchase_order.set_missing_values()

            if hasattr(purchase_order, "calculate_taxes_and_totals"):
                purchase_order.calculate_taxes_and_totals()

            purchase_order.insert()

            created.append({
                "purchase_order": purchase_order.name,
                "supplier": supplier,
                "dummy_bills": [b.name for b in group_bills]
            })

        for entry in created:
            for bill_name in entry["dummy_bills"]:
                frappe.db.set_value(
                    DUMMY_BILL,
                    bill_name,
                    "purchase_order",
                    entry["purchase_order"]
                )

        frappe.db.commit()

        return {
            "success": True,
            "count": len(created),
            "purchase_orders": created
        }

    except (frappe.ValidationError, frappe.PermissionError) as e:

        frappe.db.rollback()

        return _error_response(str(e))

    except Exception:

        return _server_error_response(
            "make_purchase_orders_from_dummy_bills failed"
        )


# ============================================================
# PURCHASE ORDER -> PURCHASE INVOICE (standard ERPNext mapping)
# ============================================================

@frappe.whitelist(methods=["POST"])
def create_purchase_invoice_from_dummy_bill(dummy_bill):

    try:

        names = _parse_bill_names(dummy_bill)

        if len(names) != 1:
            frappe.throw(_("Please select a single Saree Dummy Bill."))

        bill = _load_and_lock_bills(names)[0]

        if not frappe.has_permission(DUMMY_BILL, "write", doc=bill.name):
            frappe.throw(
                _("You do not have permission to update this record."),
                frappe.PermissionError
            )

        frappe.has_permission("Purchase Invoice", "create", throw=True)

        if bill.purchase_invoice:
            return {
                "success": True,
                "already_exists": True,
                "purchase_invoice": bill.purchase_invoice
            }

        if not bill.purchase_order:
            frappe.throw(
                _("A Purchase Order must be created before the Purchase Invoice.")
            )

        purchase_order = frappe.db.get_value(
            "Purchase Order",
            bill.purchase_order,
            ["name", "docstatus"],
            as_dict=True
        )

        if not purchase_order:
            frappe.throw(
                _("Purchase Order {0} does not exist.").format(bill.purchase_order)
            )

        if purchase_order.docstatus != 1:
            frappe.throw(
                _("Purchase Order {0} must be submitted before creating the Purchase Invoice.").format(
                    purchase_order.name
                )
            )

        existing = frappe.get_all(
            "Purchase Invoice Item",
            filters={
                "purchase_order": purchase_order.name,
                "docstatus": ["<", 2]
            },
            pluck="parent",
            limit=1
        )

        if existing:
            invoice_name = existing[0]
            already_exists = True

        else:
            from erpnext.buying.doctype.purchase_order.purchase_order import (
                make_purchase_invoice
            )

            invoice = make_purchase_invoice(purchase_order.name)
            invoice.insert()

            invoice_name = invoice.name
            already_exists = False

        linked_bills = frappe.get_all(
            DUMMY_BILL,
            filters={
                "purchase_order": purchase_order.name,
                "purchase_invoice": ["is", "not set"]
            },
            pluck="name"
        )

        for bill_name in linked_bills:
            frappe.db.set_value(
                DUMMY_BILL,
                bill_name,
                "purchase_invoice",
                invoice_name
            )

        frappe.db.commit()

        return {
            "success": True,
            "already_exists": already_exists,
            "purchase_invoice": invoice_name,
            "dummy_bills": linked_bills
        }

    except (frappe.ValidationError, frappe.PermissionError) as e:

        frappe.db.rollback()

        return _error_response(str(e))

    except Exception:

        return _server_error_response(
            "create_purchase_invoice_from_dummy_bill failed"
        )