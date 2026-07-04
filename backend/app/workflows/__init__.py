from .daily_review import daily_review_workflow
from .inactivity_rescue import inactivity_rescue_workflow
from .exam_intervention import exam_intervention_workflow

WORKFLOW_REGISTRY = {
    "daily_review": daily_review_workflow,
    "inactivity_rescue": inactivity_rescue_workflow,
    "exam_intervention": exam_intervention_workflow
}
