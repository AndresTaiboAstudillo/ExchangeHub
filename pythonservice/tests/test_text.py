from pipeline.text import display_name, name_key, slug


def test_name_key_removes_accents_punctuation_and_case():
    assert name_key("Universidad del  Bío-Bío") == "universidad del bio bio"
    assert name_key("O'HIGGINS") == "o higgins"


def test_display_name_from_uppercase():
    assert display_name("UNIVERSIDAD DEL BÍO-BÍO") == "Universidad del Bío-Bío"
    assert display_name("UNIVERSIDAD DE SAN SEBASTIÁN") == "Universidad de San Sebastián"
    assert display_name("UNIVERSIDAD DE O'HIGGINS") == "Universidad de O'Higgins"


def test_display_name_keeps_acronyms_in_mixed_case():
    assert display_name("Universidad UTEM de Chile") == "Universidad UTEM de Chile"


def test_slug():
    assert slug("Universidad de Chile") == "universidad-de-chile"


def test_display_name_uppercases_known_acronyms_and_lowers_particles():
    assert display_name("INSTITUTO PROFESIONAL DUOC UC") == "Instituto Profesional Duoc UC"
    assert display_name("CENTRO DE FORMACIÓN TÉCNICA DE LA PUCV O CFT PUCV") == (
        "Centro de Formación Técnica de la PUCV o CFT PUCV"
    )
