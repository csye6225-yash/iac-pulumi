# iac-pulumi

# Assignment 04

1.  download aws cli
    create dev and demo user account for admin and provide administrative rights

2. install pulumi

    ```brew install pulumi```

3. set the pulumi locally & configure the user account

    ```pulumi login --local```
       - select -> aws:javascript
           - create a stack with proper project name & accessKey
    ```pulumi config set aws:accessKey <AccessKey>```
    ```pulumi config set --secret  aws:secretKey <your_secret_key>```
    ```pulumi config set aws:region <region>```

4. modify index.js

    a. Create Virtual Private Cloud (VPC). \n
    b. Create subnets -> 3 public subnets and 3 private subnets. \n
    c. Create an Internet Gateway resource and attach the Internet Gateway to the VPC. \n
    d. Create a public route table. Attach all public subnets created to the route table. \n
    e. Create a private route table. Attach all private subnets created to the route table. \n
    f. Create a public route in the public route table with the destination CIDR block 0.0.0.0/0 and the internet gateway the target. \n

5. update pulumi.dev.yaml and public.demo.yaml file with all the environment variables

6. to execute the resources
    ```pulumi up```
    to destroy the resources
    ```pulumi destroy```
    and to refresh the resources
    ```pulumi refresh```