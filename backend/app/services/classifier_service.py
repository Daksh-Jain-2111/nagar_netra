from typing import Dict, Any, List, Optional

# Keywords dictionary mapping to civic categories and external redirects
CATEGORY_KEYWORDS = {
    "cat_pothole": ["pothole", "road", "crater", "asphalt", "ditch", "खड्डा", "रस्ता", "डामर"],
    "cat_garbage": ["garbage", "trash", "waste", "dump", "debris", "kachra", "कचरा", "घाण", "कचराकुंडी"],
    "cat_street_light": ["street light", "light", "lamp", "pole", "dark", "विजेचा दिवा", "दिवा", "खांब"],
    "cat_water_supply": ["water", "leak", "pipeline", "no water", "contamination", "पाणी", "गळती", "पाईप"],
    "cat_drainage": ["drain", "sewage", "gutter", "overflow", "manhole", "गटर", "सांडपाणी", "ड्रेनेज"],
    "cat_dead_animal": ["dead animal", "carcass", "dog", "cow", "cat", "मृत प्राणी", "जनावर"],
    "cat_fallen_tree": ["tree", "branch", "fallen", "blocking", "झाड", "फांदी", "झाड पडले"],
    # External redirects
    "cat_electricity_msedcl": ["electricity bill", "power cut", "transformer", "msedcl", "महावितरण", "लाईट बिल"],
    "cat_emergency_police": ["crime", "police", "theft", "fight", "पोलीस", "गुन्हा"],
    "cat_highway_nhai": ["highway", "national highway", "nhai", "expressway", "महामार्ग"]
}

class ClassifierService:
    @staticmethod
    def classify_issue(
        text: Optional[str] = None,
        has_image: bool = False,
        image_label_hint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        AI text + image classifier with 0.6 image / 0.4 text fusion.
        Returns top-3 predictions with combined confidence scores.
        Threshold = 0.70.
        """
        text_clean = (text or "").lower()
        scores: Dict[str, float] = {}

        for cat_id, keywords in CATEGORY_KEYWORDS.items():
            match_count = sum(1 for kw in keywords if kw.lower() in text_clean)
            text_score = min(match_count * 0.45, 1.0) if match_count > 0 else 0.1

            # Stub image score based on image presence and category affinity
            if has_image:
                if image_label_hint and any(kw.lower() in image_label_hint.lower() for kw in keywords):
                    image_score = 0.95
                elif match_count > 0:
                    image_score = 0.82
                else:
                    image_score = 0.35
            else:
                image_score = 0.20

            # 0.6 image / 0.4 text fusion
            fusion_score = round(0.6 * image_score + 0.4 * text_score, 2)
            scores[cat_id] = fusion_score

        # Sort top 3
        sorted_cats = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        top_3 = [
            {"category_id": cat, "confidence": score}
            for cat, score in sorted_cats[:3]
        ]

        best_guess = top_3[0]["category_id"] if top_3 else "cat_other"
        best_confidence = top_3[0]["confidence"] if top_3 else 0.50

        # Redirect check
        is_redirect = False
        redirect_target = None
        if "msedcl" in best_guess:
            is_redirect = True
            redirect_target = "MSEDCL: 1912"
        elif "police" in best_guess:
            is_redirect = True
            redirect_target = "Emergency: 112"
        elif "nhai" in best_guess:
            is_redirect = True
            redirect_target = "NHAI / PWD"

        return {
            "best_guess": best_guess,
            "confidence": best_confidence,
            "meets_threshold": best_confidence >= 0.70,
            "top_3": top_3,
            "is_redirect": is_redirect,
            "redirect_target": redirect_target
        }
