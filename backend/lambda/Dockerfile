# Dockerfile for Location Detection Lambda Function
# Uses AWS Lambda Python 3.11 base image with OpenCV

FROM public.ecr.aws/lambda/python:3.11

# Install system dependencies for OpenCV
RUN yum install -y \
    libGL \
    libgomp \
    libglib2.0-0 \
    && yum clean all

# Copy requirements and install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r requirements.txt

# Copy Lambda function code
COPY room_detector.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to your handler
CMD [ "room_detector.lambda_handler" ]

