project = "review-analysis-saas"

labels = {
  "managed-by" = "waypoint"
  "repo-rescue" = "true"
}

app "review-analysis-saas" {
  build {
    use "docker" {
      buildkit = true
    }
    
    registry {
      use "docker" {
        image = "ttl.sh/review-analysis-saas"
        tag   = gitrefpretty()
      }
    }
  }
  
  deploy {
    use var.deploy_target {
      region = var.deploy_region
    }
  }
  
  release {
    use "webhook" {
      url = var.webhook_url
      
      health_check {
        path     = "/health"
        interval = "30s"
        timeout  = "5s"
      }
    }
  }
  
  url {
    auto_hostname = true
  }
}

variable "deploy_target" {
  type        = string
  description = "Deployment target platform"
  default     = "railway"
}

variable "deploy_region" {
  type        = string
  description = "Deployment region"
  default     = "us-east-1"
}

variable "webhook_url" {
  type        = string
  description = "Webhook URL for release notifications"
  default     = ""
}
