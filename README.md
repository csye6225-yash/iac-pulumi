# iac-pulumi

1. Download AWS C

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
