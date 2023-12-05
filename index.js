const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const vpcCIDRBlock = new pulumi.Config("my_vpc").require("cidrBlock");
const publicRouteTableCIDRBlock = new pulumi.Config("my_publicRouteTable").require("cidrBlock");
const region = new pulumi.Config("aws").require("region");
const mysubnetMask = new pulumi.Config("my_subnetMask").require("subnetMask")
const myportno = new pulumi.Config("my_portNo").require("portNo")
const myamiid = new pulumi.Config("my_amiID").require("amiId")
const mykeyname = new pulumi.Config("my_keyName").require("keyName")
const dbName = new pulumi.Config("database").require("dbName");
const dbUsername = new pulumi.Config("database").require("dbUsername");
const dbPassword = new pulumi.Config("database").require("dbPassword");
const domainName = new pulumi.Config("my_domainName").require("domainName");
const gcp = require("@pulumi/gcp");
const project = new pulumi.Config("gcp").require("project");
const gcpregion = new pulumi.Config("gcp").require("region");
const sourceEmail = new pulumi.Config("source").require("email");

// Function to get available AWS availability zones
const getAvailableAvailabilityZones = async () => {
    const zones = await aws.getAvailabilityZones({ state: "available" });
    const i = Math.min(zones.names.length, 3);
    console.log('zones now: ', i);
    return zones.names.slice(0, i);
};

// Function to calculate CIDR block for subnets

const calculateSubnetCIDRBlock = (baseCIDRBlock, index) => {
    const subnetMask = mysubnetMask;
    const baseCIDRParts = baseCIDRBlock.split("/");
    const networkAddress = baseCIDRParts[0].split(".");
    const newSubnetAddress = `${networkAddress[0]}.${networkAddress[1]}.${index}.${networkAddress[2]}`;
    return `${newSubnetAddress}/${subnetMask}`;
};

// Creating Virtual Private Cloud (VPC)
const my_vpc = new aws.ec2.Vpc("my_vpc", {
    cidrBlock: vpcCIDRBlock,
    instanceTenancy: "default",
    tags: {
        Name: "my_vpc",
    },
});

// Get available availability zones
const createSubnets = async () => {
    const availabilityZones = await getAvailableAvailabilityZones();
    // Internet Gateway and attaching it to the VPC
    const my_internetGateway = new aws.ec2.InternetGateway("my_internetGateway", {
        vpcId: my_vpc.id,
        tags: {
            Name: "my_internetGateway",
        },
    });

    // Public route table and associate all public subnets
    const my_publicRouteTable = new aws.ec2.RouteTable("my_publicRouteTable", {
        vpcId: my_vpc.id,
        routes: [
            {
                cidrBlock: publicRouteTableCIDRBlock, // The destination CIDR block for the internet
                gatewayId: my_internetGateway.id, // The internet gateway as the target
            },
        ],
        tags: {
            Name: "my_publicRouteTable",
        },
    });

    // Public route in the public route table with the internet gateway as the target
    const publicRoute = new aws.ec2.Route("publicRoute", {
        routeTableId: my_publicRouteTable.id,
        destinationCidrBlock: publicRouteTableCIDRBlock,
        gatewayId: my_internetGateway.id,
    });

    const my_publicSubnets = [];
    const my_privateSubnets = [];
    for (let i = 0; i < availabilityZones.length; i++) {
        // Calculate the CIDR block for public and private subnets
        const publicSubnetCIDRBlock = calculateSubnetCIDRBlock(vpcCIDRBlock, i + 10);
        const privateSubnetCIDRBlock = calculateSubnetCIDRBlock(vpcCIDRBlock, i + 15);

        // Create public subnet
        const publicSubnet = new aws.ec2.Subnet(`my_publicSubnet${i + 1}`, {
            vpcId: my_vpc.id,
            availabilityZone: availabilityZones[i],
            cidrBlock: publicSubnetCIDRBlock, 
            mapPublicIpOnLaunch: true, // Enable auto-assign public IPv4 address
            tags: {
                Name: `my_publicSubnet${i + 1}`,
            },
        });
        my_publicSubnets.push(publicSubnet);

        // Create private subnet
        const privateSubnet = new aws.ec2.Subnet(`my_privateSubnet${i + 1}`, {
            vpcId: my_vpc.id,
            availabilityZone: availabilityZones[i],
            cidrBlock: privateSubnetCIDRBlock, 
            tags: {
                Name: `my_privateSubnet${i + 1}`,
            },
        });
        my_privateSubnets.push(privateSubnet);
    }

    const loadBalancerSecurityGroup = new aws.ec2.SecurityGroup("loadBalancerSecurityGroup", {
        vpcId: my_vpc.id,
        ingress: [
            {
                fromPort: 80,
                toPort: 80,
                protocol: "tcp",
                cidrBlocks: ["0.0.0.0/0"], // Allow HTTP from anywhere
            },
            {
                fromPort: 443,
                toPort: 443,
                protocol: "tcp",
                cidrBlocks: ["0.0.0.0/0"], // Allow HTTPS from anywhere
            },
        ],
        // egress: [
        //     {
        //         protocol: "-1", // -1 means all protocols
        //         fromPort: 0,
        //         toPort: 0, // Set both fromPort and toPort to 0 to allow all ports
        //         cidrBlocks: ["0.0.0.0/0"],
        //     },
        // ],
        tags: {
            Name: "loadBalancerSecurityGroup",
        },
    });

    // EC2 Security Group for Web Applications
    const appSecurityGroup = new aws.ec2.SecurityGroup("appSecurityGroup", {
        vpcId: my_vpc.id,
        ingress: [
            {
                fromPort: 22,
                toPort: 22,
                protocol: "tcp",
                // cidrBlocks: ["0.0.0.0/0"], // Allow SSH from anywhere
                securityGroups: [loadBalancerSecurityGroup.id], // Allow SSH only from the load balancer
            },
            // {
            //     fromPort: 80,
            //     toPort: 80,
            //     protocol: "tcp",
            //     cidrBlocks: ["0.0.0.0/0"], // Allow HTTP from anywhere
            // },
            // {
            //     fromPort: 443,
            //     toPort: 443,
            //     protocol: "tcp",
            //     cidrBlocks: ["0.0.0.0/0"], // Allow HTTPS from anywhere
            // },
            // rule for my application port 
            {
                fromPort: myportno,
                toPort: myportno,
                protocol: "tcp",
                // cidrBlocks: ["0.0.0.0/0"],
                securityGroups: [loadBalancerSecurityGroup.id], // Allow SSH only from the load balancer
            }
        ],
        egress: [
            {
                protocol: "-1", // all protocols
                fromPort: 0,
                toPort: 0,
                cidrBlocks: ["0.0.0.0/0"],
            },
        ],
        tags: {
            Name: "appSecurityGroup",
        },
    });

    for (let i = 0; i < my_publicSubnets.length; i++) {
        new aws.ec2.RouteTableAssociation(`my_publicRouteTableAssociation-${i}`, {
            subnetId: my_publicSubnets[i].id,
            routeTableId: my_publicRouteTable.id,
        });
    }

    // Create a private route table and associate all private subnets
    const my_privateRouteTable = new aws.ec2.RouteTable("my_privateRouteTable", {
        vpcId: my_vpc.id,
        tags: {
            Name: "my_privateRouteTable",
        },
    });

    for (let i = 0; i < my_privateSubnets.length; i++) {
        new aws.ec2.RouteTableAssociation(`my_privateRouteTableAssociation-${i}`, {
            subnetId: my_privateSubnets[i].id,
            routeTableId: my_privateRouteTable.id,
        });
    }

    //---------- RDS Config

    const databaseSecurityGroup = new aws.ec2.SecurityGroup("databaseSecurityGroup", {
        vpcId: my_vpc.id,
        ingress: [
            // Add ingress rule for your application port
            {
                fromPort: 3306,
                toPort: 3306,
                protocol: "tcp",
                securityGroups: [appSecurityGroup.id]
            },
        ],
        egress: [
             // Add egress rule for your application port
             {
                fromPort: 3306,
                toPort: 3306,
                protocol: "tcp",
                securityGroups: [appSecurityGroup.id]
            },
        ]
    });
    await databaseSecurityGroup.id; 

    pulumi.log.info(
        pulumi.interpolate`Database Security Group VPC ID: ${databaseSecurityGroup.id}`
    );

    // Create an RDS parameter group

    const rdsParameterGroup = new aws.rds.ParameterGroup("myRdsParameterGroup", {
        vpcId: my_vpc.id,
        family: "mariadb10.6",
        name: "my-rds-parameter-group",
        parameters: [
            {
                name: "character_set_server",
                value: "utf8",
            },
            {
                name: "collation_server",
                value: "utf8_general_ci",
            },
        ],
        tags: {
            Name: "myRdsParameterGroup",
        },
    });

    // Create a DB subnet group
    const dbSubnetGroup = new aws.rds.SubnetGroup("myDbSubnetGroup", {
        subnetIds: [my_privateSubnets[0].id, my_privateSubnets[1].id],
        name: "my-db-subnet-group",
        tags: {
            Name: "myDbSubnetGroup",
        },
    });

    // Create an RDS instance

    const rdsInstance = new aws.rds.Instance("myRDSInstance", {
        vpcId: my_vpc.id,
        vpcSecurityGroupIds: [databaseSecurityGroup.id],
        dbSubnetGroupName: dbSubnetGroup.name,
        engine: "mariadb",
        instanceClass: "db.t2.micro",
        multiAz: false,
        identifier: "csye6225",
        dbName: dbName,
        username: dbUsername,
        password: dbPassword,
        allocatedStorage: 20,
        storageType: "gp2",
        //maxAllocatedStorage: 20,
        skipFinalSnapshot: true,
        publiclyAccessible: false, // Set to false to restrict access to the internet
        parameterGroupName: rdsParameterGroup.name,
        tags: {
            Name: "myRDSInstance",
        },
    });
    pulumi.log.info(
        pulumi.interpolate`RDS instance id: ${rdsInstance.id}`
    );

    let myloadbalancerEgressRule = new aws.ec2.SecurityGroupRule("myloadbalancerEgressRule", {
        type: "egress",
        securityGroupId: loadBalancerSecurityGroup.id,
        protocol: "tcp",
        fromPort: 8080,
        toPort: 8080,
        sourceSecurityGroupId: appSecurityGroup.id
      
      });

    //----------- user data config

    // Specify the database configuration
    const dbHostname = pulumi.interpolate`${rdsInstance.address}`;

    let serviceAccount = new gcp.serviceaccount.Account("myServiceAccount", {
        accountId: "myserviceaccount123",
        displayName: "My Service Account",
    });
 
    // Access keys for the Google Service account
    let accessKeys = new gcp.serviceaccount.Key("myAccessKeys", {
        serviceAccountId: serviceAccount.name,
        //publicKeyType: "TYPE_X509_PEM_FILE",
    });

    // Grant storage permissions
    let storageObjectCreatorRole = new gcp.projects.IAMMember("storageObjectCreator", {
        project: project,
        role: "roles/storage.objectCreator",
        member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
    });

    // Create an SNS topic
    const mySNSTopic = new aws.sns.Topic("mySNSTopic", {
        displayName: "My SNS Topic",
        tags: {
            Name: "mySNSTopic",
        },
    });

    pulumi.log.info(
        pulumi.interpolate`SNS Topic ARN: ${mySNSTopic.arn}`
    );

    const snsArn = mySNSTopic.arn;

    const bucket = new gcp.storage.Bucket("my-bucket", {
        cors: [{
            maxAgeSeconds: 3600,
            methods: [
                "GET",
                "HEAD",
                "PUT",
                "POST",
                "DELETE",
            ],
            origins: ["http://demo.bhatiayash.me"],
            responseHeaders: ["*"],
        }],
        forceDestroy: true,
        uniformBucketLevelAccess: true,
        location: gcpregion,
    },
    );

    const dynamoDb = new aws.dynamodb.Table("mytable", {
        attributes: [
            { name: "id", type: "S" },
            { name: "email", type: "S" },
            { name: "submissionURL", type: "S" },
            { name: "gcsURL", type: "S" },
            { name: "emailSentTime", type: "S" },
            { name: "assignmentId", type: "S" },
            { name: "accountId", type: "S" },
            { name: "status", type: "S" }
        ],
        hashKey: "id",
        readCapacity: 1,
        writeCapacity: 1,
        globalSecondaryIndexes: [
            {
                name: "EmailIndex",
                hashKey: "email",
                projectionType: "ALL",
                readCapacity: 1,
                writeCapacity: 1,
            },
            {
                name: "SubmissionUrlIndex",
                hashKey: "submissionURL",
                projectionType: "ALL",
                readCapacity: 1,
                writeCapacity: 1,
            },
            {
                name: "GcsUrlIndex",
                hashKey: "gcsURL",
                projectionType: "ALL",
                readCapacity: 1,
                writeCapacity: 1,
            },
            {
                name: "EmailSentTimeIndex",
                hashKey: "emailSentTime",
                projectionType: "ALL",
                readCapacity: 1,
                writeCapacity: 1,
            },
            {
                name: "AssignmentIdIndex",
                hashKey: "assignmentId",
                projectionType: "ALL",
                readCapacity: 1,
                writeCapacity: 1,
            },
            {
                name: "AccountIdIndex",
                hashKey: "accountId",
                projectionType: "ALL",
                readCapacity: 1,
                writeCapacity: 1,
            },
            {
                name: "StatusIndex",
                hashKey: "status",
                projectionType: "ALL",
                readCapacity: 1,
                writeCapacity: 1,
            },
        ]
    });

    let lambdaRole = new aws.iam.Role("lambdaRole", {
        assumeRolePolicy: JSON.stringify({
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "sts:AssumeRole",
                    "Principal": { "Service": "lambda.amazonaws.com" },
                    "Effect": "Allow",
                }
            ],
        }),
    });
 
    let snsPublishPolicy = new aws.iam.RolePolicy("snsPublishPolicy", {
        role: lambdaRole.id,
        policy: pulumi.all([snsArn]).apply(([snsArn]) => JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: "sns:Publish",
                    Resource: snsArn
                }
            ]
        })),
    },
    {
        dependsOn: mySNSTopic
    });

    // Full access for SES
    const fullAccessToSES = new aws.iam.RolePolicyAttachment("fullAccessToSES", {
        role: lambdaRole.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonSESFullAccess",
    });
 
    let fullAccessToDynamoDb = new aws.iam.RolePolicyAttachment("fullAccessToDynamoDb", {
        role: lambdaRole.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
    });
 
    // Attach policies to Lambda IAM Role
    const lambdaPolicy = new aws.iam.RolePolicyAttachment("lambdaPolicy", {
        role: lambdaRole.name,
        policyArn: "arn:aws:iam::aws:policy/AWSLambda_FullAccess",
    });

    // Attach lambda cloudwatch policy
    const cloudwatchPolicy = new aws.iam.RolePolicyAttachment("logPolicy", {
        role: lambdaRole.name,
        policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    });

    const lambdaFunction = new aws.lambda.Function("lambdaFunction", {
        code: new pulumi.asset.FileArchive("./serverless.zip"),
        role: lambdaRole.arn,
        handler: "serverless/index.handler",
        runtime: "nodejs18.x",
        timeout: 10,
        environment: {
            variables: {
                "BUCKET_NAME": bucket.name,
                "GOOGLE_CREDENTIALS": accessKeys.privateKey,
                "GOOGLE_PROJECT_ID": project,
                "DYNAMODB_TABLE": dynamoDb.name,
                "SOURCE_EMAIL": sourceEmail,
                "REGION": region
            },
        },
    });

    const lambdaPermission = new aws.lambda.Permission("snsTopicPermission", {
        action: "lambda:InvokeFunction",
        function: lambdaFunction,
        principal: "sns.amazonaws.com",
        sourceArn: mySNSTopic.arn
    });
 
    // SNS topic subscription
    let topicSubscription = new aws.sns.TopicSubscription("mySubscription", {
        topic: snsArn,
        endpoint: lambdaFunction.arn,
        protocol: "lambda",
    },
    {
        dependsOn: mySNSTopic
    });
 
    // // IAM Policy for Lambda to get invoked by SNS
    // let lambdaInvoke = new aws.iam.RolePolicy("lambdaInvoke", {
    //     role: lambdaRole.id,
    //     policy: pulumi.all([snsArn]).apply(([snsArn]) => JSON.stringify({
    //         Version: "2012-10-17",
    //         Statement: [
    //             {
    //                 Effect: "Allow",
    //                 Action: "sns:Publish",
    //                 Resource: snsArn,
    //             }
    //         ]
    //     })),
    // },
    // {
    //     dependsOn: mySNSTopic
    // });

    // User data script to configure the EC2 instance
    const userDataScript = pulumi.interpolate`#!/bin/bash
    echo "MYSQL_DATABASE=${dbName}" >> /opt/csye6225/Yash_Bhatia_002791499_03/.env
    echo "MYSQL_USER=${dbUsername}" >> /opt/csye6225/Yash_Bhatia_002791499_03/.env
    echo "MYSQL_PASSWORD=${dbPassword}" >> /opt/csye6225/Yash_Bhatia_002791499_03/.env
    echo "MYSQL_HOSTNAME=${dbHostname}" >> /opt/csye6225/Yash_Bhatia_002791499_03/.env
    echo "SNS_TOPIC_ARN=${mySNSTopic.arn}" >> /opt/csye6225/Yash_Bhatia_002791499_03/.env
    # Start the CloudWatch Agent and enable it to start on boot
    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/csye6225/Yash_Bhatia_002791499_03/amazon-cloudwatch-agent.json
    sudo systemctl enable amazon-cloudwatch-agent
    sudo systemctl start amazon-cloudwatch-agent
    `;
    pulumi.log.info(
        pulumi.interpolate`DB data: dbHostname, userDataScript - ${dbHostname}, ${userDataScript}`
    );

    const encodedUserData = userDataScript.apply(ud => Buffer.from(ud).toString('base64'));
    

    // Create IAM Role for CloudWatch Agent
    const ec2CloudWatch = new aws.iam.Role("ec2CloudWatch", {
        assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Action: "sts:AssumeRole",
                Effect: "Allow",
                Principal: {
                    Service: "ec2.amazonaws.com",
                },
            }],
        }),
    });
    
    // Attach AmazonCloudWatchAgentServerPolicy to the IAM role
    const cloudWatchAgentPolicyAttachment = new aws.iam.RolePolicyAttachment("CloudWatchAgentPolicyAttachment", {
        role: ec2CloudWatch,
        policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
    });

     // Attach IAM policy for CloudWatch Agent to the role
     const cloudWatchAgentSNSPolicyAttachment = new aws.iam.PolicyAttachment("cloudWatchAgentSNSPolicyAttachment", {
        policyArn: "arn:aws:iam::aws:policy/AmazonSNSFullAccess",
        roles: [ec2CloudWatch.name],
    });
    
    let instanceProfile = new aws.iam.InstanceProfile("myInstanceProfile", {
        role: ec2CloudWatch.name
    });

    // Function to create Route53 DNS A record
    const createDnsARecord = async (domainName, loadBalancer) => {
        const hostedZone = await aws.route53.getZone({
            name: domainName,
        });
    
        if (hostedZone) {
            const recordName = domainName;
            const recordType = "A";
            const recordTtl = 60;
            const recordSet = new aws.route53.Record(`dnsARecord-${recordName}`, {
                name: recordName,
                type: recordType,
                zoneId: hostedZone.zoneId,
                aliases: [
                    {
                        evaluateTargetHealth: true,
                        name: loadBalancer.dnsName,
                        zoneId: loadBalancer.zoneId,
                    },
                ],
                //records: [ec2Instance.publicIp],
                //ttl: recordTtl,
                allowOverwrite: true,
            });
        }
        else
        {
            console.error(`Zone for domain '${domainName}' not found.`);
        }
    };

    
    const loadBalancer = new aws.lb.LoadBalancer("myLoadBalancer", {
        internal: false,
        loadBalancerType: "application",
        securityGroups: [loadBalancerSecurityGroup.id], // load balancer security group
        subnets: my_publicSubnets.map(subnet => subnet.id),
        enableDeletionProtection: false,
        // enableHttp2: true,
        // idleTimeout: 60,
        // enableCrossZoneLoadBalancing: true,
        tags: {
            Name: "myLoadBalancer",
        },
    });

    //Launch Template
    const launchTemplate = new aws.ec2.LaunchTemplate("myLaunchTemplate", {
        name: "myLaunchTemplate",
        version: "$Latest",
        vpcId: my_vpc.id,
        rootBlockDevice: {
            volumeSize: 25,
            volumeType: "gp2",
            deleteOnTermination: true,
        },
        securityGroups: [appSecurityGroup.id],
        vpcSecurityGroupIds: [appSecurityGroup.id],
        imageId: myamiid,
        instanceType: "t2.micro",
        keyName: mykeyname,
        userData: encodedUserData,
        protectFromTermination: false,
        associatePublicIpAddress: false,
        iamInstanceProfile: { name: instanceProfile.name },
    });

    const targetGroup = new aws.lb.TargetGroup("myTargetGroup", {
        port: myportno, // Replace with your application port
        protocol: "HTTP",
        targetType: "instance",
        vpcId: my_vpc.id,
        healthCheck: {
            path: "/healthz",
            port: "8080",
            protocol: "HTTP",
            interval: 30,
            timeout: 10,
            healthyThreshold: 3,
            unhealthyThreshold: 3,
        }
    });

    const certificate = await aws.acm.getCertificate({
        domain: domainName,
        mostRecent: true,
        statuses: ["ISSUED"],
    });

    const certificateArn = pulumi.interpolate`${certificate.arn}`;

    const listener = new aws.lb.Listener("myListener", {
        loadBalancerArn: loadBalancer.arn,
        //port: 80,
        port: 443,
        protocol: "HTTPS",
        defaultActions: [{
            type: "forward",
            targetGroupArn: targetGroup.arn
        }],
        sslPolicy: "ELBSecurityPolicy-2016-08",
        certificateArn: certificateArn,
    });
    

    //Auto scaling group
    const autoScalingGroup = new aws.autoscaling.Group("myAutoScalingGroup", {
        vpcZoneIdentifiers: my_publicSubnets.map(subnet => subnet.id),
        launchTemplate: {
            id: launchTemplate.id,
            // version: launchTemplate.latestVersion,
            version: "$Latest",
        },
        iamInstanceProfile: { name: instanceProfile.name },
        minSize: 1,
        maxSize: 3,
        desiredCapacity: 1,
        cooldown: 60,
        healthCheckType: "EC2",
        waitForCapacityTimeout: "0",
        protectFromScaleIn: false,
        // healthCheckGracePeriod: 300,
        // forceDelete: true,
        tags: [
            {
                key: "Name",
                value: "myAutoScalingGroup",
                propagateAtLaunch: true,
            },
            // A
        ],
        targetGroupArns: [targetGroup.arn],
        instanceRefresh: {
            strategy: "Rolling",
            preferences: {
                minHealthyPercentage: 90,
                instanceWarmup: 60,
            },
        },
        forceDelete: true
    });

    //Auto Scaling policy
    const scaleUpPolicy = new aws.autoscaling.Policy("scaleUpPolicy", {
        scalingAdjustment: 1,
        adjustmentType: "ChangeInCapacity",
        cooldown: 60,
        autoscalingGroupName: autoScalingGroup.name,
        policyType: 'SimpleScaling',
    });
    
    const scaleDownPolicy = new aws.autoscaling.Policy("scaleDownPolicy", {
        scalingAdjustment: -1,
        adjustmentType: "ChangeInCapacity",
        cooldown: 60,
        autoscalingGroupName: autoScalingGroup.name,
        policyType: 'SimpleScaling',
    });

    // Define CPU utilization alarms for the autoscaling policies
    const highCpuAlarm = new aws.cloudwatch.MetricAlarm("HighCpuAlarm", {
        alarmDescription: "Scaling Up Alarm",
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        evaluationPeriods: "2",
        metricName: "CPUUtilization",
        namespace: "AWS/EC2",
        period: "60",
        statistic: "Average",
        threshold: "5",
        actionsEnabled: true,
        alarmActions: [scaleUpPolicy.arn],
        dimensions: {
            AutoScalingGroupName: autoScalingGroup.name,
        }
    });
 
    const lowCpuAlarm = new aws.cloudwatch.MetricAlarm("LowCpuAlarm", {
        alarmDescription: "Scaling Down Alarm",
        comparisonOperator: "LessThanOrEqualToThreshold",
        evaluationPeriods: "1",
        metricName: "CPUUtilization",
        namespace: "AWS/EC2",
        period: "60",
        statistic: "Average",
        threshold: "3",
        actionsEnabled: true,
        alarmActions: [scaleDownPolicy.arn],
        dimensions: {
            AutoScalingGroupName: autoScalingGroup.name,
        },
    });
    // // EC2 Instance
    // const ec2Instance = new aws.ec2.Instance("ec2Instance", {
    //     instanceType: "t2.micro",
    //     ami: myamiid,
    //     vpcSecurityGroupIds: [appSecurityGroup.id],
    //     subnetId: my_publicSubnets[0].id,
    //     vpcId: my_vpc.id,
    //     keyName: mykeyname,
    //     rootBlockDevice: {
    //         volumeSize: 25,
    //         volumeType: "gp2",
    //     },
    //     protectFromTermination: false,
    //     userData: userDataScript, // Attach the user data script
    //     tags: {
    //         Name: "EC2Instance",
    //     },
    //     iamInstanceProfile: instanceProfile.name,
    // });
    
    // Call the function to create DNS A record
    createDnsARecord(domainName, loadBalancer);
};

//function to create subnets
createSubnets();