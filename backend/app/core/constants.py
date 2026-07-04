"""
TUS exam constants
"""

TUS_SUBJECTS = [
    "Anatomi",
    "Fizyoloji-Histoloji",
    "Patoloji",
    "Biyokimya",
    "Mikrobiyoloji",
    "Dahiliye",
    "Pediatri",
    "Genel Cerrahi",
    "Küçük Stajlar",
    "Kadın Doğum",
    "Farmakoloji",
]

# Canonical tur rotation order for study planning
TUS_SUBJECT_ORDER = [
    "Fizyoloji-Histoloji",
    "Patoloji",
    "Dahiliye",
    "Biyokimya",
    "Pediatri",
    "Anatomi",
    "Genel Cerrahi",
    "Kadın Doğum",
    "Küçük Stajlar",
    "Mikrobiyoloji",
    "Farmakoloji",
]

# Tur (round) configurations — reading + question days per subject
TUR_CONFIGS = {
    1: {
        "label": "Yeni Başlayan",
        "default_reading_days": 4,
        "default_question_days": 2,
        "large_subjects": ["Dahiliye", "Pediatri"],
        "large_reading_days": 6,
        "large_question_days": 3,
    },
    2: {
        "label": "2. Tur",
        "default_reading_days": 3,
        "default_question_days": 2,
        "large_subjects": ["Dahiliye", "Pediatri"],
        "large_reading_days": 4,
        "large_question_days": 2,
    },
    3: {
        "label": "3. Tur",
        "default_reading_days": 2,
        "default_question_days": 1,
        "large_subjects": ["Dahiliye", "Pediatri"],
        "large_reading_days": 3,
        "large_question_days": 2,
    },
    4: {
        "label": "4. Tur",
        "default_reading_days": 1,
        "default_question_days": 1,
        "large_subjects": ["Dahiliye", "Pediatri"],
        "large_reading_days": 2,
        "large_question_days": 1,
    },
}


def compute_tur_duration(tur_number: int) -> int:
    """Calculate total days for a given tur number."""
    config = TUR_CONFIGS[tur_number]
    total = 0
    for subject in TUS_SUBJECT_ORDER:
        if subject in config["large_subjects"]:
            total += config["large_reading_days"] + config["large_question_days"]
        else:
            total += config["default_reading_days"] + config["default_question_days"]
    return total
