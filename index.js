const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const vpcCIDRBlock = new pulumi.Config("my_vpc").require("cidrBlock");
const publicRouteTableCIDRBlock = new pulumi.Config("my_publicRouteTable").require("cidrBlock");
const region = new pulumi.Config("aws").require("region");
const mysubnetMask = new pulumi.Config("my_subnetMask").require("subnetMask")
const myportno = new pulumi.Config("my_portNo").require("portNo")
const myamiid = new pulumi.Config("my_amiID").require("amiId")
const mykeyname = new pulumi.Config("my_keyName").require("keyName")

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

    // EC2 Security Group for Web Applications
    const appSecurityGroup = new aws.ec2.SecurityGroup("appSecurityGroup", {
        vpcId: my_vpc.id,
        ingress: [
            {
                fromPort: 22,
                toPort: 22,
                protocol: "tcp",
                cidrBlocks: ["0.0.0.0/0"], // Allow SSH from anywhere
            },
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
            // rule for my application port 
            {
                fromPort: myportno,
                toPort: myportno,
                protocol: "tcp",
                cidrBlocks: ["0.0.0.0/0"],
            }
        ],
        tags: {
            Name: "appSecurityGroup",
        },
    });
    
    // // Create an EC2 instance in the first public subnet
    // const ec2Instance = new aws.ec2.Instance("ec2Instance", {
    //     instanceType: "t2.micro", // Set the desired instance type
    //     ami: "ami-01fba9a558f9152e1", // Replace with your custom AMI ID
    //     vpcSecurityGroupIds: [appSecurityGroup.id], // Assuming you have defined appSecurityGroup
    //     subnetId: my_publicSubnets[0].id, // Choose the first public subnet
    //     //vpcId : my_vpc.id,
    //     keyName: "webapp_keypair",
    //     rootBlockDevice: {
    //         volumeSize: 25,
    //         volumeType: "gp2",
    //     },
    //     tags: {
    //         Name: "EC2Instance",
    //     },
    // });


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

    // EC2 Instance
    const ec2Instance = new aws.ec2.Instance("ec2Instance", {
        instanceType: "t2.micro",
        ami: myamiid,
        vpcSecurityGroupIds: [appSecurityGroup.id],
        subnetId: my_publicSubnets[0].id,
        vpcId: my_vpc.id,
        keyName: mykeyname,
        rootBlockDevice: {
            volumeSize: 25,
            volumeType: "gp2",
        },
        tags: {
            Name: "EC2Instance",
        },
    });
};

//function to create subnets
createSubnets();