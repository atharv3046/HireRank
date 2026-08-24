import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models import *  # Import all models

TEST_DATABASE_URL = "sqlite:///./test_resume_screening.db"

@pytest.fixture(scope="session")
def db():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

SAMPLE_RESUMES = {
    "senior_python_dev": """
John Smith
john.smith@email.com
+1 (555) 123-4567

Summary
Senior Python Developer with 8 years of experience building scalable web applications.

Experience
Senior Software Engineer - TechCorp Inc.
Jan 2020 - Present
- Led team of 5 engineers building microservices with Python, FastAPI, Docker, Kubernetes
- Reduced API latency by 40% using Redis caching and PostgreSQL optimization

Software Engineer - StartupXYZ
March 2017 - December 2019
- Built data pipelines using Python, Pandas, Apache Spark
- Deployed ML models using TensorFlow and scikit-learn

Skills
Python, FastAPI, Django, PostgreSQL, Redis, Docker, Kubernetes, AWS, TensorFlow,
scikit-learn, Pandas, NumPy, Git, Linux, REST API, Microservices

Education
Master of Science in Computer Science
University of California, Berkeley - 2017
""",
    "junior_frontend_dev": """
Jane Doe
jane.doe@email.com
(555) 987-6543

Objective
Recent graduate seeking frontend developer position.

Education
Bachelor of Science in Computer Science
State University, 2022

Experience
Junior Web Developer - WebAgency
June 2022 - Present
- Built React components for e-commerce websites
- Implemented responsive designs using Tailwind CSS

Skills
JavaScript, TypeScript, React, Vue.js, HTML, CSS, Tailwind CSS, Git, REST API, Node.js
""",
    "data_scientist": """
Dr. Alice Johnson
alice.j@datalab.com
+44 7700 900123

Summary
Data Scientist with PhD in Statistics and 5 years industry experience.

Experience
Lead Data Scientist - DataDriven Corp
2021 - Present
- Built recommendation systems using Python, scikit-learn, TensorFlow
- Deployed models with MLflow and Docker

Data Scientist - Analytics Inc
2019 - 2021
- Performed A/B testing and statistical analysis
- Built dashboards using Plotly and Tableau

Skills
Python, R, Machine Learning, Deep Learning, TensorFlow, PyTorch, scikit-learn,
Pandas, NumPy, SQL, PostgreSQL, Docker, MLflow, Statistics, Data Visualization

Education
PhD in Statistics - Oxford University, 2019
Bachelor of Science in Mathematics - Cambridge University, 2014
""",
    "incomplete_resume": """
Bob

I have some experience with computers and coding.
Worked at a company for a while.
"""
}
