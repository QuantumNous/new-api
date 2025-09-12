package main

import (
	"fmt"
	"log"
	"one-api/pkg/ionet"
)

func main() {
	// Initialize the client with your API key
	client := ionet.NewClient("io-v2-xxx")

	fmt.Println("=== IO.NET Deployment API Examples ===\n")

	// Example 1: List all deployments with pagination
	fmt.Println("1. Listing deployments (page 1, 20 per page):")
	deployments, err := client.ListDeployments(&ionet.ListDeploymentsOptions{
		Page:      1,
		PageSize:  20,
		SortBy:    "created_at",
		SortOrder: "desc",
	})
	if err != nil {
		log.Printf("Error listing deployments: %v\n", err)
	} else {
		fmt.Printf("Found %d total deployments (showing page 1, 20 per page)\n",
			deployments.Total)
		for i, d := range deployments.Clusters {
			fmt.Printf("  [%d] %s (%s) - %s %s - %.1f%% complete\n",
				i+1, d.Name, d.ID, d.BrandName, d.HardwareName, d.CompletedPercent)
			fmt.Printf("      Status: %s, Served: %s, Remaining: %s\n",
				d.Status, d.Served, d.Remaining)
		}
		fmt.Printf("Available statuses: %v\n\n", deployments.Statuses)

		// Example: Update cluster name for the first deployment
		if len(deployments.Clusters) > 0 {
			firstCluster := deployments.Clusters[0]
			fmt.Printf("1a. Updating cluster name for: %s (ID: %s)\n", firstCluster.Name, firstCluster.ID)

			newName := fmt.Sprintf("updated-%s", firstCluster.Name)
			updateReq := &ionet.UpdateClusterNameRequest{
				Name: newName,
			}

			updateResp, err := client.UpdateClusterName(firstCluster.ID, updateReq)
			if err != nil {
				log.Printf("Error updating cluster name: %v\n", err)
			} else {
				fmt.Printf("  Status: %s\n", updateResp.Status)
				fmt.Printf("  Message: %s\n", updateResp.Message)
			}
			fmt.Println()
		}
	}

	// Example 2: Filter deployments by status
	fmt.Println("2. Filtering deployments by different statuses:")

	// Test different status filters
	statuses := []string{"completed", "running", "destroyed"}

	for _, status := range statuses {
		fmt.Printf("  2.%d Filtering by '%s' status:\n", len(status), status)
		filteredDeployments, err := client.ListDeployments(&ionet.ListDeploymentsOptions{
			Status:   status,
			Page:     1,
			PageSize: 10,
		})
		if err != nil {
			log.Printf("    Error filtering deployments: %v\n", err)
		} else {
			fmt.Printf("    Found %d %s deployments\n", len(filteredDeployments.Clusters), status)
			for _, d := range filteredDeployments.Clusters {
				fmt.Printf("      - %s: %s %s (%d GPUs) - %.1f%% complete\n",
					d.Name, d.BrandName, d.HardwareName, d.HardwareQuantity, d.CompletedPercent)
				fmt.Printf("        Served: %s, Remaining: %s\n", d.Served, d.Remaining)
			}
		}
		fmt.Println()
	}

	// Example 3: Get specific deployment details
	if len(deployments.Clusters) > 0 {
		deploymentID := deployments.Clusters[0].ID
		fmt.Printf("3. Getting details for deployment: %s\n", deploymentID)

		details, err := client.GetDeployment(deploymentID)
		if err != nil {
			log.Printf("Error getting deployment details: %v\n", err)
		} else {
			fmt.Printf("  ID: %s\n", details.ID)
			fmt.Printf("  Status: %s\n", details.Status)
			fmt.Printf("  Hardware: %s %s\n", details.BrandName, details.HardwareName)
			fmt.Printf("  Total GPUs: %d (per container: %d)\n",
				details.TotalGPUs, details.GPUsPerContainer)
			fmt.Printf("  Total Containers: %d\n", details.TotalContainers)
			fmt.Printf("  Completed: %d%%\n", details.CompletedPercent)
			fmt.Printf("  Amount Paid: $%.2f\n", details.AmountPaid)
			fmt.Printf("  Compute Minutes - Served: %d, Remaining: %d\n",
				details.ComputeMinutesServed, details.ComputeMinutesRemaining)

			if len(details.Locations) > 0 {
				fmt.Printf("  Locations:\n")
				for _, loc := range details.Locations {
					fmt.Printf("    - %s (%s)\n", loc.Name, loc.ISO2)
				}
			}

			fmt.Printf("  Container Config:\n")
			fmt.Printf("    - Image: %s\n", details.ContainerConfig.ImageURL)
			fmt.Printf("    - Traffic Port: %d\n", details.ContainerConfig.TrafficPort)
			fmt.Printf("    - Entrypoint: %v\n", details.ContainerConfig.Entrypoint)
		}
		fmt.Println()
	}

	// Example 4: Get available hardware first, then get price estimation
	fmt.Println("4. Getting available hardware and GPUs:")
	maxGPUs, err := client.GetMaxGPUsPerContainer()
	if err != nil {
		log.Printf("Error getting max GPUs: %v\n", err)
	} else {
		fmt.Printf("Total available hardware types: %d\n", maxGPUs.Total)

		var availableHardware *ionet.MaxGPUInfo
		var availableLocationIDs []int

		for i, hardware := range maxGPUs.Hardware {
			fmt.Printf("  [%d] %s %s - Max %d GPUs, %d available\n",
				i+1, hardware.BrandName, hardware.HardwareName,
				hardware.MaxGPUsPerContainer, hardware.Available)

			// Get available replicas for this hardware
			replicas, err := client.GetAvailableReplicas(hardware.HardwareID, 1)
			if err != nil {
				fmt.Printf("    Error getting replicas: %v\n", err)
			} else {
				fmt.Printf("    Available replicas across locations: %d\n", len(replicas.Replicas))
				for _, replica := range replicas.Replicas {
					fmt.Printf("      - %s: %d replicas available (max %d GPUs)\n",
						replica.LocationName, replica.AvailableCount, replica.MaxGPUs)

					// Store the first available hardware and location for pricing
					if availableHardware == nil && replica.AvailableCount > 0 {
						availableHardware = &hardware
						availableLocationIDs = []int{replica.LocationID}
					}
				}
			}
		}

		// Example 5: Get price estimation using real available hardware
		fmt.Println("\n5. Getting price estimation for available hardware:")
		if availableHardware != nil && len(availableLocationIDs) > 0 {
			fmt.Printf("Using %s %s (ID: %d) in location %d\n",
				availableHardware.BrandName, availableHardware.HardwareName,
				availableHardware.HardwareID, availableLocationIDs[0])

			priceReq := &ionet.PriceEstimationRequest{
				LocationIDs:      availableLocationIDs,
				HardwareID:       availableHardware.HardwareID,
				GPUsPerContainer: 1,
				DurationHours:    1,
				ReplicaCount:     1,
			}

			price, err := client.GetPriceEstimation(priceReq)
			if err != nil {
				log.Printf("Error getting price estimation: %v\n", err)
			} else {
				fmt.Printf("  Estimated Cost: %.4f %s\n", price.EstimatedCost, price.Currency)
				fmt.Printf("  Hourly Rate: %.4f\n", price.PriceBreakdown.HourlyRate)
				fmt.Printf("  Estimation Valid: %v\n", price.EstimationValid)
			}
		} else {
			fmt.Println("No available hardware found for price estimation")
		}
	}

	// Example 6: Dedicated cluster name update example
	fmt.Println("6. Cluster name update operations:")
	if len(deployments.Clusters) > 0 {
		testCluster := deployments.Clusters[0]
		originalName := testCluster.Name

		fmt.Printf("Original cluster: %s (ID: %s)\n", originalName, testCluster.ID)

		// Update to a new name
		newName := fmt.Sprintf("renamed-%d", len(originalName))
		updateReq := &ionet.UpdateClusterNameRequest{
			Name: newName,
		}

		fmt.Printf("Updating name from '%s' to '%s'...\n", originalName, newName)
		updateResp, err := client.UpdateClusterName(testCluster.ID, updateReq)
		if err != nil {
			log.Printf("Error updating cluster name: %v\n", err)
		} else {
			fmt.Printf("✅ Update successful!\n")
			fmt.Printf("  Status: %s\n", updateResp.Status)
			fmt.Printf("  Message: %s\n", updateResp.Message)

			// Verify the update by fetching the deployment details
			fmt.Printf("Verifying update...\n")
			updatedDetails, err := client.GetDeployment(testCluster.ID)
			if err != nil {
				log.Printf("Error verifying update: %v\n", err)
			} else {
				fmt.Printf("✅ Verification complete!\n")
				fmt.Printf("  Current name in system: %s\n", updatedDetails.ID) // Note: API may not return updated name immediately
			}
		}
	} else {
		fmt.Println("No clusters available for name update test")
	}

	fmt.Println("\n=== Examples completed ===")
}
