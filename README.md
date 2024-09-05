# Infrastructure as Code - Pulumi

In your Pulumi JavaScript file (e.g., `index.js`), use Pulumi to define and deploy your infrastructure.

## AWS Resources

### Virtual Private Cloud (VPC)

- Created a new VPC named `"my_vpc"` with the specified CIDR block.

### Internet Gateway

- Created a new Internet Gateway named `"my_internetGateway"` and attached it to the VPC.

### Availability Zones

- Queried and obtained the first three availability zones.

### Subnets

- Created public and private subnets in each availability zone.
- Associated route tables with the subnets.

### Route Tables

- Created public and private route tables.
- Associated subnets with route tables.

### Security Groups

- Created security groups for the load balancer, EC2 instances, and RDS instance.

### RDS (Relational Database Service)

- Created a MySQL RDS instance with specified configurations.

### IAM (Identity and Access Management)

- Created an IAM role with policies for EC2 instances.
- Attached policies for CloudWatch and S3 to the role.

### Load Balancer

- Created an Application Load Balancer with specified configurations.
- Configured listeners and target groups.

### Auto Scaling

- Created an Auto Scaling Group with scaling policies and CloudWatch alarms.

### AWS Lambda

- Created an IAM role and attached policies for Lambda function.

### SNS (Simple Notification Service)

- Created an SNS topic and subscription for Lambda function.

### AWS CloudWatch Alarms

- Created CloudWatch alarms for scaling based on CPU utilization.

### Route53

- Created a Route53 record for the load balancer.

### AWS DynamoDB

- Created a DynamoDB table with specified attributes and global secondary indexes.
- Configured an IAM policy for DynamoDB access and attached it to the Lambda execution role.

## Google Cloud Platform (GCP) Resources

### Cloud Storage (GCS)

- Created a GCS bucket named `"my_bucket"` with versioning enabled.

### GCP IAM

- Created a service account with necessary permissions and attached it to the GCS bucket.

### GCP IAM Policy

- Attached a custom IAM policy to the Lambda execution role for GCS access.

## Steps to create this infrastructure

1. Download AWS CLI

2. Install pulumi

    ```
   brew install pulumi
   ```

3. Set the pulumi locally & configure the user account
    ```
   pulumi login --local
   ```
    ```
   pulumi config set aws:accessKey <AccessKey>
   ```
   ```
   pulumi config set --secret  aws:secretKey <your_secret_key>
   ```
   ```
   pulumi config set aws:region <region>
   ```

4. Update pulumi.dev.yaml and public.demo.yaml file with all the environment variables
   
5. Import SSL certificate to AWS Certificate Manager
   ```
   aws acm import-certificate --certificate fileb://demo.bhatiayash.me.crt \
   --certificate-chain fileb://demo.bhatiayash.me.ca-bundle \
   --private-key fileb://demo.bhatiayash.me_key.txt
   ```

6. To execute the resources
    ```
   pulumi up
   ```
7. To destroy the resources
    ```
   pulumi destroy
   ```
8. To refresh the resources
    ```
   pulumi refresh
   ```
