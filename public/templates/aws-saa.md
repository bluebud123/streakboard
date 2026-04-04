# AWS Solutions Architect Associate (SAA-C03)

## Cloud Fundamentals
- [ ] AWS Global Infrastructure (Regions, AZs, Edge Locations)
- [ ] Shared Responsibility Model
- [ ] IAM — Users, Groups, Roles, Policies
- [ ] IAM — MFA, password policies, access keys
- [ ] AWS Organizations and Service Control Policies (SCPs)
- [ ] AWS CLI and SDK usage
- [ ] Billing, Cost Explorer, Budgets
- [ ] AWS Support plans

## Compute
- [ ] EC2 — instance types (C, M, R, T families)
- [ ] EC2 — purchasing options (On-demand, Reserved, Spot, Dedicated)
- [ ] EC2 — placement groups (cluster, spread, partition)
- [ ] Auto Scaling Groups — launch templates, scaling policies
- [ ] Load Balancers — ALB, NLB, CLB
- [ ] Elastic Beanstalk
- [ ] Lambda — triggers, concurrency, cold starts, layers
- [ ] ECS and EKS — containerisation on AWS
- [ ] Fargate — serverless containers
- [ ] AWS Batch

## Storage
- [ ] S3 — storage classes (Standard, IA, Glacier, Intelligent-Tiering)
- [ ] S3 — versioning, lifecycle policies, replication
- [ ] S3 — security (bucket policies, ACLs, pre-signed URLs)
- [ ] S3 — static website hosting
- [ ] EBS — volume types (gp3, io2, st1, sc1)
- [ ] EBS — snapshots, encryption, multi-attach
- [ ] EFS — NFS shared file system for EC2
- [ ] FSx — FSx for Windows, FSx for Lustre
- [ ] AWS Storage Gateway
- [ ] Snowball and DataSync for migrations

## Databases
- [ ] RDS — supported engines, Multi-AZ vs Read Replica
- [ ] RDS — automated backups, snapshots, encryption
- [ ] Aurora — serverless, global database, multi-master
- [ ] DynamoDB — partition keys, GSI, LSI, DAX
- [ ] DynamoDB — streams, TTL, capacity modes
- [ ] ElastiCache — Redis vs Memcached use cases
- [ ] Redshift — data warehousing and spectrum
- [ ] DocumentDB, Keyspaces, Neptune, QLDB
- [ ] Database Migration Service (DMS)

## Networking
- [ ] VPC — subnets, route tables, internet gateways
- [ ] VPC — NAT Gateway vs NAT Instance
- [ ] Security Groups vs Network ACLs
- [ ] VPC Peering, Transit Gateway
- [ ] VPN and Direct Connect
- [ ] Route 53 — routing policies (simple, weighted, failover, latency, geolocation)
- [ ] CloudFront — distributions, origins, caching, OAI
- [ ] API Gateway — REST vs HTTP API, stages, throttling
- [ ] Global Accelerator
- [ ] Elastic IP addresses

## Security
- [ ] KMS — CMKs, key policies, envelope encryption
- [ ] Secrets Manager vs Systems Manager Parameter Store
- [ ] AWS Shield — Standard and Advanced (DDoS)
- [ ] AWS WAF — rules, web ACLs
- [ ] CloudTrail — API logging and compliance
- [ ] Amazon Inspector — EC2 and ECR vulnerability scanning
- [ ] Amazon GuardDuty — threat detection
- [ ] Security Hub and Macie

## Application Integration
- [ ] SQS — standard vs FIFO, visibility timeout, DLQ
- [ ] SNS — fan-out pattern, topic subscriptions
- [ ] EventBridge — event buses, rules, targets
- [ ] Step Functions — state machines, orchestration
- [ ] Kinesis Data Streams — shards, consumers
- [ ] Kinesis Firehose — delivery to S3, Redshift, Splunk
- [ ] AppSync — managed GraphQL

## Monitoring & Management
- [ ] CloudWatch — metrics, alarms, logs, dashboards
- [ ] CloudWatch Events / EventBridge
- [ ] AWS Config — compliance, config rules
- [ ] Systems Manager — patch manager, run command, session manager
- [ ] Trusted Advisor — five pillar checks
- [ ] Well-Architected Framework — six pillars
- [ ] CloudFormation — templates, stacks, change sets, drift detection

## High Availability & Disaster Recovery
- [ ] RTO vs RPO definitions
- [ ] Backup and restore strategy
- [ ] Pilot light strategy
- [ ] Warm standby strategy
- [ ] Multi-site active/active strategy
- [ ] S3 Cross-Region Replication for DR
- [ ] Aurora global database for DR
