import datetime
from sqlalchemy.orm import Session

from backend.app.database import SessionLocal, Base, engine
from backend.app.models.models import (
    Corporation, OrgUnit, Ward, Department, Category, RoutingRule,
    User, OfficerStatus, InviteCode, Complaint, ComplaintEvent, Setting
)
from backend.app.services.auth_service import get_password_hash
from backend.app.services.geo_service import DEMO_WARDS_GEOJSON

def seed_database(force_reseed: bool = False):
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    if not force_reseed and db.query(Corporation).filter(Corporation.id == "SMKMC").first():
        print("Database already seeded with SMKMC data.")
        db.close()
        return

    if force_reseed:
        print("Resetting and reseeding database...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    print("Seeding SMKMC database...")

    # 1. Corporations
    corp_smkmc = Corporation(
        id="SMKMC",
        name="Sangli Miraj Kupwad Municipal Corporation",
        name_mr="सांगली मिरज कुपवाड महानगरपालिका",
        status="ACTIVE"
    )
    corp_kdmc = Corporation(
        id="KDMC",
        name="Kalyan Dombivli Municipal Corporation (DEMO)",
        name_mr="कल्याण डोंबिवली महानगरपालिका (डेमो)",
        status="ACTIVE"
    )
    db.add_all([corp_smkmc, corp_kdmc])

    # 2. Org Units
    units = [
        OrgUnit(id="unit_roads", corporation_id="SMKMC", name="Roads & Civil Works Division", name_mr="रस्ते व स्थापत्य विभाग", level_type="Division", supervisor_id="usr_dmc1"),
        OrgUnit(id="unit_waste", corporation_id="SMKMC", name="Solid Waste Management Division", name_mr="घनकचरा व्यवस्थापन विभाग", level_type="Division", supervisor_id="usr_dmc1"),
        OrgUnit(id="unit_water", corporation_id="SMKMC", name="Water Supply & Sewerage Division", name_mr="पाणीपुरवठा व मलनिस्सारण विभाग", level_type="Division", supervisor_id="usr_dmc1"),
        OrgUnit(id="unit_elec", corporation_id="SMKMC", name="Street Lighting & Electrical Division", name_mr="विद्युत व पथदिवे विभाग", level_type="Division", supervisor_id="usr_dmc1"),
        OrgUnit(id="unit_health", corporation_id="SMKMC", name="Public Health & Sanitation Division", name_mr="आरोग्य व स्वच्छता विभाग", level_type="Division", supervisor_id="usr_dmc1"),
        OrgUnit(id="unit_kdmc_roads", corporation_id="KDMC", name="KDMC Roads Division", name_mr="केडीएमसी रस्ते विभाग", level_type="Division"),
    ]
    db.add_all(units)

    # 3. Wards (all labelled DEMO)
    for w in DEMO_WARDS_GEOJSON:
        ward_obj = Ward(
            id=w["id"],
            corporation_id="SMKMC",
            ward_number=w["ward_number"],
            name=w["name"],
            name_mr=w.get("name_mr"),
            polygon_geojson=w
        )
        db.add(ward_obj)

    # 4. Departments
    depts = [
        Department(id="dept_roads", corporation_id="SMKMC", name="Roads & Traffic Works", name_mr="रस्ते व वाहतूक", code="RD", color="#0B3D66"),
        Department(id="dept_waste", corporation_id="SMKMC", name="Solid Waste Management", name_mr="घनकचरा व्यवस्थापन", code="SWM", color="#2E7D32"),
        Department(id="dept_water", corporation_id="SMKMC", name="Water Supply & Drainage", name_mr="पाणीपुरवठा व जलनिस्सारण", code="WSD", color="#0288D1"),
        Department(id="dept_elec", corporation_id="SMKMC", name="Street Lighting & Electrical", name_mr="पथदिवे व विद्युत", code="ELEC", color="#F57C00"),
        Department(id="dept_health", corporation_id="SMKMC", name="Public Health & Veterinary", name_mr="सार्वजनिक आरोग्य", code="HLTH", color="#7B1FA2"),
        Department(id="dept_kdmc_roads", corporation_id="KDMC", name="KDMC Roads", name_mr="रस्ते", code="KRD", color="#0B3D66"),
    ]
    db.add_all(depts)

    # 5. Categories
    categories = [
        Category(id="cat_pothole", corporation_id="SMKMC", department_id="dept_roads", name="Pothole / Road Surface Damage", name_mr="रस्त्यावरील खड्डे", priority="HIGH", resolution_hours=72, is_urgent=False),
        Category(id="cat_garbage", corporation_id="SMKMC", department_id="dept_waste", name="Garbage Overflow / Uncleaned Bin", name_mr="कचरा साचणे / कचराकुंडी", priority="URGENT", resolution_hours=24, is_urgent=True),
        Category(id="cat_street_light", corporation_id="SMKMC", department_id="dept_elec", name="Non-functional Street Light", name_mr="बंद पडलेला विजेचा दिवा", priority="MEDIUM", resolution_hours=48, is_urgent=False),
        Category(id="cat_water_supply", corporation_id="SMKMC", department_id="dept_water", name="Water Pipeline Leakage / Contamination", name_mr="पाण्याची पाईपलाईन गळती", priority="URGENT", resolution_hours=24, is_urgent=True),
        Category(id="cat_drainage", corporation_id="SMKMC", department_id="dept_water", name="Open Drain / Sewage Overflow / Manhole", name_mr="गटार तुंबणे / मॅनहोल", priority="HIGH", resolution_hours=48, is_urgent=False),
        Category(id="cat_dead_animal", corporation_id="SMKMC", department_id="dept_health", name="Dead Animal Removal", name_mr="मृत प्राणी उचलणे", priority="URGENT", resolution_hours=12, is_urgent=True),
        Category(id="cat_fallen_tree", corporation_id="SMKMC", department_id="dept_roads", name="Fallen Tree / Blocked Road", name_mr="झाड पडणे / रस्ता अडवणे", priority="HIGH", resolution_hours=24, is_urgent=False),
        Category(id="cat_electricity_msedcl", corporation_id="SMKMC", department_id="dept_elec", name="Power Outage / Transformer Defect", name_mr="वीज पुरवठा खंडित (महावितरण)", priority="LOW", resolution_hours=0, is_urgent=False, redirect_target="MSEDCL: 1912"),
        Category(id="cat_other", corporation_id="SMKMC", department_id="dept_roads", name="Other Civic Issue", name_mr="इतर नागरी तक्रार", priority="MEDIUM", resolution_hours=72, is_urgent=False),
        Category(id="cat_kdmc_pothole", corporation_id="KDMC", department_id="dept_kdmc_roads", name="Pothole Damage", name_mr="खड्डा", priority="HIGH", resolution_hours=72, is_urgent=False),
    ]
    db.add_all(categories)

    # 6. Users (Staff & Citizen)
    hashed_demo = get_password_hash("Demo@123")
    users = [
        # Supervisor
        User(id="usr_dmc1", corporation_id="SMKMC", name="Ramesh Gaikwad (DMC)", email="dmc1@smkmc.demo", mobile="9823011111", hashed_password=hashed_demo, role="supervisor", is_active=True),
        # Corp Admin
        User(id="usr_admin", corporation_id="SMKMC", name="Priya Joshi (Corp Admin)", email="admin@smkmc.demo", mobile="9823022222", hashed_password=hashed_demo, role="corp_admin", is_active=True),
        # Helpdesk
        User(id="usr_helpdesk", corporation_id="SMKMC", name="Anand Shinde (Helpdesk)", email="helpdesk@smkmc.demo", mobile="9823033333", hashed_password=hashed_demo, role="helpdesk", is_active=True),
        # Platform Admin
        User(id="usr_platform", corporation_id="SMKMC", name="Vikram Seth (Platform Admin)", email="platform@nagarnetra.demo", mobile="9823044444", hashed_password=hashed_demo, role="platform_admin", is_active=True),
        
        # Field Officers (with required email addresses)
        User(id="usr_fo_roads", corporation_id="SMKMC", unit_id="unit_roads", name="Sunil Kadam (Junior Engineer - Roads)", email="officer.roads@smkmc.demo", mobile="9823055555", hashed_password=hashed_demo, role="field_officer", is_active=True),
        User(id="usr_fo_swm", corporation_id="SMKMC", unit_id="unit_waste", name="Amit Patil (Sanitary Inspector - SWM)", email="officer.swm@smkmc.demo", mobile="9823066666", hashed_password=hashed_demo, role="field_officer", is_active=True),
        User(id="usr_fo_water", corporation_id="SMKMC", unit_id="unit_water", name="Sachin Chavan (Water Works Officer)", email="water.officer@smkmc.demo", mobile="9823077777", hashed_password=hashed_demo, role="field_officer", is_active=True),
        User(id="usr_fo_elec", corporation_id="SMKMC", unit_id="unit_elec", name="Mahesh Shinde (Electrical Overseer)", email="elec.officer@smkmc.demo", mobile="9823088888", hashed_password=hashed_demo, role="field_officer", is_active=True),
        
        # KDMC user for tenant isolation testing
        User(id="usr_kdmc_admin", corporation_id="KDMC", name="KDMC Admin", email="admin@kdmc.demo", mobile="9823099999", hashed_password=hashed_demo, role="corp_admin", is_active=True),
        
        # Citizen
        User(id="usr_9822014589", corporation_id="SMKMC", name="Sunita Patil", mobile="9822014589", email="sunita.patil@demo.nagarnetra.in", role="citizen", is_active=True),
    ]
    db.add_all(users)

    # 7. Officer Statuses & Mutual Backups
    # officer.roads has backup officer.swm, and officer.swm has backup officer.roads
    statuses = [
        OfficerStatus(user_id="usr_fo_roads", is_on_leave=False, backup_user_id="usr_fo_swm"),
        OfficerStatus(user_id="usr_fo_swm", is_on_leave=False, backup_user_id="usr_fo_roads"),
        OfficerStatus(user_id="usr_fo_water", is_on_leave=False, backup_user_id="usr_fo_roads"),
        OfficerStatus(user_id="usr_fo_elec", is_on_leave=False, backup_user_id="usr_fo_roads"),
    ]
    db.add_all(statuses)

    # 8. Invite Code SMKMC-W7-984
    invite = InviteCode(
        id="inv_1",
        corporation_id="SMKMC",
        code="SMKMC-W7-984",
        role="field_officer",
        unit_id="unit_roads"
    )
    db.add(invite)

    # 9. Routing Rules
    rules = [
        RoutingRule(id="rule_pothole", corporation_id="SMKMC", category_id="cat_pothole", unit_id="unit_roads", is_active=True),
        RoutingRule(id="rule_fallen_tree", corporation_id="SMKMC", category_id="cat_fallen_tree", unit_id="unit_roads", is_active=True),
        RoutingRule(id="rule_garbage", corporation_id="SMKMC", category_id="cat_garbage", unit_id="unit_waste", is_active=True),
        RoutingRule(id="rule_water", corporation_id="SMKMC", category_id="cat_water_supply", unit_id="unit_water", is_active=True),
        RoutingRule(id="rule_drainage", corporation_id="SMKMC", category_id="cat_drainage", unit_id="unit_water", is_active=True),
        RoutingRule(id="rule_street_light", corporation_id="SMKMC", category_id="cat_street_light", unit_id="unit_elec", is_active=True),
        RoutingRule(id="rule_dead_animal", corporation_id="SMKMC", category_id="cat_dead_animal", unit_id="unit_health", is_active=True),
    ]
    db.add_all(rules)

    # 10. Settings
    settings_list = [
        Setting(corporation_id="SMKMC", key="enable_l2", value={"enabled": False}),
        Setting(corporation_id="SMKMC", key="ai_confidence_threshold", value={"threshold": 0.70}),
        Setting(corporation_id="SMKMC", key="vision_text_weight", value={"vision": 0.60, "text": 0.40}),
    ]
    db.add_all(settings_list)

    # 11. Initial Complaints matching Prompt Section B specifications
    now = datetime.datetime.utcnow()

    # Base reference date for 2026 demo timeline (approx Oct 8, 2026)
    base_time = datetime.datetime(2026, 10, 8, 12, 0, 0)

    complaints = [
        # NN-2026-000101: pothole, Vishrambag Ward 12, IN_PROGRESS + work scheduled 18 Oct
        Complaint(
            id="NN-2026-000101",
            corporation_id="SMKMC",
            citizen_id="usr_9822014589",
            citizen_name="Sunita Patil",
            citizen_mobile="9822014589",
            category_id="cat_pothole",
            description="Deep pothole outside Vishrambag central bus stop, repair crew scheduled",
            latitude=16.8524,
            longitude=74.5815,
            address="Vishrambag Chowk, Ward 12 (DEMO), Sangli",
            ward_id="ward_12",
            unit_id="unit_roads",
            assignee_id="usr_fo_roads",
            status="IN_PROGRESS",
            priority="HIGH",
            photo_verified=True,
            created_at=base_time - datetime.timedelta(days=1),
            response_due=base_time + datetime.timedelta(hours=24),
            resolution_due=datetime.datetime(2026, 10, 18, 18, 0, 0),
            channel="app"
        ),

        # NN-2026-000113: ASSIGNED, respond by 9 Oct 10:00, fix by 14 Oct
        Complaint(
            id="NN-2026-000113",
            corporation_id="SMKMC",
            citizen_id="usr_9822014589",
            citizen_name="Sunita Patil",
            citizen_mobile="9822014589",
            category_id="cat_street_light",
            description="Flickering lamp near College Corner",
            latitude=16.8530,
            longitude=74.5820,
            address="College Corner, Ward 12 (DEMO), Sangli",
            ward_id="ward_12",
            unit_id="unit_elec",
            assignee_id="usr_fo_elec",
            status="ASSIGNED",
            priority="MEDIUM",
            photo_verified=True,
            created_at=datetime.datetime(2026, 10, 7, 10, 0, 0),
            response_due=datetime.datetime(2026, 10, 9, 10, 0, 0),
            resolution_due=datetime.datetime(2026, 10, 14, 18, 0, 0),
            channel="app"
        ),

        # NN-2026-000103: streetlight, Miraj Market, L1 response_missed
        Complaint(
            id="NN-2026-000103",
            corporation_id="SMKMC",
            citizen_id=None,
            citizen_name="Anonymous citizen",
            citizen_mobile=None,
            is_anonymous=True,
            category_id="cat_street_light",
            description="Two street lights completely dark near Miraj Vegetable Market",
            latitude=16.8286,
            longitude=74.6433,
            address="Miraj Vegetable Market, Ward 5 (DEMO)",
            ward_id="ward_5",
            unit_id="unit_elec",
            assignee_id="usr_fo_elec",
            status="ASSIGNED",
            priority="MEDIUM",
            escalation_level="L1",
            escalation_reason="response_missed",
            escalated_at=base_time - datetime.timedelta(hours=6),
            created_at=base_time - datetime.timedelta(hours=54),
            response_due=base_time - datetime.timedelta(hours=6),
            resolution_due=base_time + datetime.timedelta(hours=42),
            channel="phone"
        ),

        # NN-2026-000105: no water near Miraj Station, TO_CHECK
        Complaint(
            id="NN-2026-000105",
            corporation_id="SMKMC",
            citizen_id="usr_9822014589",
            citizen_name="Sunita Patil",
            citizen_mobile="9822014589",
            category_id="cat_water_supply",
            description="No water supply near Miraj Station residential lane for two days",
            latitude=16.8350,
            longitude=74.6520,
            address="Miraj Station Road, Ward 8 (DEMO)",
            ward_id="ward_8",
            unit_id="unit_water",
            assignee_id=None,
            status="TO_CHECK",
            priority="URGENT",
            photo_verified=False,
            created_at=base_time - datetime.timedelta(hours=6),
            response_due=base_time + datetime.timedelta(hours=18),
            resolution_due=base_time + datetime.timedelta(hours=18),
            channel="walkin"
        ),

        # NN-2026-000108 / NN-2026-000114: garbage, Ganpati Peth, 35 m apart
        Complaint(
            id="NN-2026-000108",
            corporation_id="SMKMC",
            citizen_id="usr_9822014589",
            citizen_name="Sunita Patil",
            citizen_mobile="9822014589",
            category_id="cat_garbage",
            description="Garbage piling up outside temple road bins in Ganpati Peth",
            latitude=16.84500,
            longitude=74.56000,
            address="Temple Road, Ward 1 - Ganpati Peth (DEMO)",
            ward_id="ward_1",
            unit_id="unit_waste",
            assignee_id="usr_fo_swm",
            status="ASSIGNED",
            priority="URGENT",
            photo_verified=True,
            created_at=base_time - datetime.timedelta(hours=10),
            response_due=base_time + datetime.timedelta(hours=14),
            resolution_due=base_time + datetime.timedelta(hours=14),
            channel="app"
        ),
        Complaint(
            id="NN-2026-000114",
            corporation_id="SMKMC",
            citizen_id=None,
            citizen_name="Anonymous citizen",
            citizen_mobile=None,
            is_anonymous=True,
            category_id="cat_garbage",
            description="Overflowing community waste bin near Ganpati Peth sweet shop (35m from temple)",
            # 35 meters apart: 0.00025 deg lat ~ 28m, 0.00020 deg lon ~ 21m
            latitude=16.84525,
            longitude=74.56020,
            address="Ganpati Peth Sweet Market, Ward 1 - Ganpati Peth (DEMO)",
            ward_id="ward_1",
            unit_id="unit_waste",
            assignee_id="usr_fo_swm",
            status="ASSIGNED",
            priority="URGENT",
            photo_verified=True,
            created_at=base_time - datetime.timedelta(hours=4),
            response_due=base_time + datetime.timedelta(hours=20),
            resolution_due=base_time + datetime.timedelta(hours=20),
            channel="phone"
        ),

        # NN-2026-000104: open manhole, Kupwad MIDC, RESOLVED, 5 days left to reopen, 1 of 2 reopens used
        Complaint(
            id="NN-2026-000104",
            corporation_id="SMKMC",
            citizen_id="usr_9822014589",
            citizen_name="Sunita Patil",
            citizen_mobile="9822014589",
            category_id="cat_drainage",
            description="Open manhole on main Kupwad MIDC road. Concrete slab installed.",
            latitude=16.8789,
            longitude=74.6225,
            address="Kupwad MIDC Phase 2, Ward 18 (DEMO)",
            ward_id="ward_18",
            unit_id="unit_water",
            assignee_id="usr_fo_water",
            status="RESOLVED",
            priority="HIGH",
            danger_flag=True,
            danger_verified=True,
            photo_verified=True,
            created_at=base_time - datetime.timedelta(days=4),
            response_due=base_time - datetime.timedelta(days=3),
            resolution_due=base_time - datetime.timedelta(days=2),
            resolved_at=base_time - datetime.timedelta(days=2), # 2 days ago -> 5 days left out of 7
            reopen_count=1, # 1 of 2 reopens used
            channel="app"
        ),

        # KDMC complaint for tenant isolation test
        Complaint(
            id="NN-2026-000201",
            corporation_id="KDMC",
            citizen_id=None,
            citizen_name="Anonymous citizen",
            citizen_mobile=None,
            is_anonymous=True,
            category_id="cat_kdmc_pothole",
            description="KDMC road depression near Station",
            latitude=19.2400,
            longitude=73.1300,
            address="Kalyan Station Road, KDMC",
            ward_id=None,
            unit_id="unit_kdmc_roads",
            assignee_id=None,
            status="SUBMITTED",
            priority="HIGH",
            photo_verified=False,
            created_at=base_time,
            response_due=base_time + datetime.timedelta(hours=48),
            resolution_due=base_time + datetime.timedelta(hours=72),
            channel="app"
        ),
    ]
    db.add_all(complaints)

    # Initial Complaint Events
    for c in complaints:
        db.add(ComplaintEvent(
            complaint_id=c.id,
            actor_id=c.citizen_id or "anonymous",
            actor_name=c.citizen_name or "Citizen",
            actor_role="citizen",
            action="COMPLAINT_SUBMITTED",
            to_status=c.status,
            comment="Complaint filed in system.",
            created_at=c.created_at
        ))
        if c.id == "NN-2026-000101":
            db.add(ComplaintEvent(
                complaint_id=c.id,
                actor_id="usr_fo_roads",
                actor_name="Sunil Kadam (Junior Engineer - Roads)",
                actor_role="field_officer",
                action="WORK_SCHEDULED",
                from_status="ASSIGNED",
                to_status="IN_PROGRESS",
                comment="Work scheduled for 18 Oct 2026 by asphalt repair squad.",
                created_at=c.created_at + datetime.timedelta(hours=2)
            ))
        elif c.id == "NN-2026-000104":
            db.add(ComplaintEvent(
                complaint_id=c.id,
                actor_id="usr_fo_water",
                actor_name="Sachin Chavan",
                actor_role="field_officer",
                action="RESOLVED",
                from_status="IN_PROGRESS",
                to_status="RESOLVED",
                comment="Installed reinforced concrete manhole cover. 1st reopen was verified.",
                created_at=c.resolved_at
            ))

    db.commit()
    print("Database seeding completed successfully.")
    db.close()

    # Voice-note demo ticket (idempotent; also run at startup for databases seeded earlier)
    from backend.app.seed.demo_voice_ticket import ensure_demo_voice_ticket
    ensure_demo_voice_ticket()

if __name__ == "__main__":
    seed_database()
