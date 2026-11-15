"""Job records as citable sections and as schema.org JobPosting (FR-J1, FR-T11). No dependencies."""

from __future__ import annotations


def job_to_section(job: dict) -> dict:
    """A job record as a citable section, so the assistant can answer about it."""
    def join(*parts: object) -> str:
        return " ".join(str(p).strip() for p in parts if p)

    acc_en = job.get("accommodations_en") or []
    acc_am = job.get("accommodations_am") or []
    return {
        "id": f"job-{job['id']}",
        "type": "job",
        "job_id": job["id"],
        "url": f"/pages/jobs.html#job-{job['id']}",
        "deadline": job.get("deadline"),
        "title_en": join(job.get("title_en"), "-", job.get("employer"), "-", job.get("location_en")),
        "title_am": join(job.get("title_am"), "-", job.get("employer"), "-", job.get("location_am")),
        "text_en": join(job.get("summary_en"), job.get("requirements_en"), ("Support offered: " + ", ".join(acc_en) + ".") if acc_en else ""),
        "text_am": join(job.get("summary_am"), job.get("requirements_am"), ("የሚቀርብ ድጋፍ፦ " + "፣ ".join(acc_am) + "።") if acc_am else ""),
        "keywords_en": (job.get("keywords_en") or []) + ["job", "apply", "deadline"],
        "keywords_am": (job.get("keywords_am") or []) + ["ሥራ", "ማመልከት", "የመጨረሻ ቀን"],
    }


def jsonld(job: dict) -> dict:
    """schema.org/JobPosting (Level 3). Accommodations go in jobBenefits."""
    data = {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "identifier": job["id"],
        "title": job["title_en"],
        "description": job["summary_en"],
        "datePosted": job["date_posted"],
        "validThrough": job["deadline"],
        "employmentType": job.get("employment_type", "FULL_TIME"),
        "hiringOrganization": {"@type": "Organization", "name": job["employer"]},
        "jobLocation": {
            "@type": "Place",
            "address": {"@type": "PostalAddress", "addressLocality": job["location_en"], "addressCountry": "ET"},
        },
    }
    if job.get("remote"):
        data["jobLocationType"] = "TELECOMMUTE"
        data["applicantLocationRequirements"] = {"@type": "Country", "name": "Ethiopia"}
    if job.get("accommodations_en"):
        data["jobBenefits"] = ", ".join(job["accommodations_en"])
    if job.get("experience_months") is not None:
        data["experienceRequirements"] = {"@type": "OccupationalExperienceRequirements", "monthsOfExperience": job["experience_months"]}
    return data
