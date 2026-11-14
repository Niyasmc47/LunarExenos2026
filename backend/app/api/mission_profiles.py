from typing import List
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.mission_profile import (
    MissionProfile,
    MissionProfileCreateRequest,
    MissionProfileUpdateRequest,
    MissionProfileValidationRequest,
    MissionProfileValidationResponse,
)
from app.services.mission_profile_service import mission_profile_service, TEMPLATE_PROFILES

router = APIRouter(prefix="/api/profiles", tags=["Mission Requirements & Profiles"])

@router.get("/", response_model=List[MissionProfile], summary="List all saved mission profiles and templates")
def list_profiles():
    return mission_profile_service.list_profiles()

@router.get("/templates/list", response_model=List[MissionProfile], summary="List built-in illustrative mission templates")
def list_templates():
    return TEMPLATE_PROFILES

# Static POST routes MUST come before /{profile_id} to avoid path conflicts
@router.post("/validate", response_model=MissionProfileValidationResponse, summary="Validate profile requirements and time bounds")
def validate_profile(req: MissionProfileValidationRequest):
    return mission_profile_service.validate_profile_request(req)

@router.post("/reset-templates", response_model=List[MissionProfile], summary="Restore missing built-in illustrative templates")
def reset_templates():
    return mission_profile_service.reset_to_templates()

@router.get("/{profile_id}", response_model=MissionProfile, summary="Get single mission profile by ID")
def get_profile(profile_id: str):
    profile = mission_profile_service.get_profile(profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission profile '{profile_id}' not found."
        )
    return profile

@router.post("/", response_model=MissionProfile, status_code=status.HTTP_201_CREATED, summary="Create a new mission profile")
def create_profile(req: MissionProfileCreateRequest):
    try:
        return mission_profile_service.create_profile(req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.put("/{profile_id}", response_model=MissionProfile, summary="Update an existing mission profile")
def update_profile(profile_id: str, req: MissionProfileUpdateRequest):
    try:
        return mission_profile_service.update_profile(profile_id, req)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{profile_id}/duplicate", response_model=MissionProfile, status_code=status.HTTP_201_CREATED, summary="Duplicate a mission profile")
def duplicate_profile(profile_id: str):
    try:
        return mission_profile_service.duplicate_profile(profile_id)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a mission profile")
def delete_profile(profile_id: str):
    try:
        mission_profile_service.delete_profile(profile_id)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

